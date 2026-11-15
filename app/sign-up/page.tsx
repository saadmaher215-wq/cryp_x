'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SignUpStep = 'details' | 'verify-otp';
type CheckStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
};

export default function CrypXEnterpriseSignUp() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<SignUpStep>('details');
  const [serverPing, setServerPing] = useState<number | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(true);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [usernameStatus, setUsernameStatus] = useState<CheckStatus>('idle');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [emailStatus, setEmailStatus] = useState<CheckStatus>('idle');
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendSeconds, setResendSeconds] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('جاري المعالجة...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get('ref');
      if (refParam) {
        setReferralCode(refParam.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20));
      }
    }

    const checkConnection = async () => {
      const t0 = performance.now();
      try {
        await supabase.from('users').select('id').limit(1);
        setServerPing(Math.max(10, Math.round(performance.now() - t0)));
      } catch {
        setServerPing(null);
      }
    };
    checkConnection();
  }, []);

  useEffect(() => {
    const clean = username.trim().toLowerCase();
    setUsernameSuggestions([]);

    if (!clean) {
      setUsernameStatus('idle');
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    const timeout = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('id')
          .ilike('username', clean)
          .maybeSingle();

        if (data) {
          setUsernameStatus('taken');
          const num = Math.floor(10 + Math.random() * 89);
          setUsernameSuggestions([
            `${clean}_${num}`,
            `${clean}_x`,
            `its_${clean}`.slice(0, 20),
          ]);
        } else {
          setUsernameStatus('available');
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 450);

    return () => clearTimeout(timeout);
  }, [username]);

  useEffect(() => {
    const clean = email.trim().toLowerCase();
    const parts = clean.split('@');
        if (!clean || parts.length !== 2 || !parts[0] || !parts[1].includes('.')) {
      setEmailStatus('idle');
      return;
    }

    setEmailStatus('checking');
    const timeout = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('id')
                    .ilike('email', clean)
          .maybeSingle();

        setEmailStatus(data ? 'taken' : 'available');
      } catch {
        setEmailStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [email]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);
  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailSuggestion(null);
    const clean = value.trim().toLowerCase();
    if (clean.includes('@')) {
      const [local, domain] = clean.split('@');
      if (domain && DOMAIN_TYPOS[domain]) {
        setEmailSuggestion(`${local}@${DOMAIN_TYPOS[domain]}`);
      }
    }
  };

  const handleSelectAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('يرجى اختيار صورة صالحة بصيغة JPG أو PNG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('الحد الأقصى لحجم الصورة هو 5 ميجابايت.');
      return;
    }

    setErrorMsg(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleGeneratePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const nums = '23456789';
    const syms = '@#$%&*!?';
    const pool = upper + lower + nums + syms;

    let pwd =
      upper[Math.floor(Math.random() * upper.length)] +
      lower[Math.floor(Math.random() * lower.length)] +
      nums[Math.floor(Math.random() * nums.length)] +
      syms[Math.floor(Math.random() * syms.length)];

    for (let i = 0; i < 10; i++) {
      pwd += pool[Math.floor(Math.random() * pool.length)];
    }

    const finalPwd = pwd
      .split('')
      .sort(() => 0.5 - Math.random())
      .join('');

    setPassword(finalPwd);
    setConfirmPassword(finalPwd);
    setShowPassword(true);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(finalPwd).catch(() => {});
    }
    setSuccessMsg('تم إنشاء كلمة مرور قوية من 14 خانة ونسخها تلقائياً.');
  };

  const getPasswordStrength = (pwd: string) => {
    const rules = {
      length: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      symbol: /[^A-Za-z0-9]/.test(pwd),
    };
    const score = Object.values(rules).filter(Boolean).length;
    return { score, rules };
  };

  const uploadAvatarToStorage = async (userId: string, displayName: string): Promise<string> => {
    const fallback = `https://ui-avatars.com{encodeURIComponent(
      displayName
    )}&background=0ea5e9&color=fff&bold=true&size=256`;

    if (!avatarFile) return fallback;

    try {
      const ext = avatarFile.name.split('.').pop() || 'png';
      const path = `avatars/${userId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, avatarFile, { upsert: true });
      if (error) return fallback;

      const { data } = supabase.storage.from('media').getPublicUrl(path);
      return data?.publicUrl || fallback;
    } catch {
      return fallback;
    }
  };

  const createUserRecord = async (
    userId: string,
    userFullName: string,
    userHandle: string,
    userEmail: string,
    userBio: string
  ) => {
    setLoadingLabel('جاري تجهيز ملفك الشخصي...');
    const imageUrl = await uploadAvatarToStorage(userId, userFullName);

    await supabase.from('users').upsert(
      {
        id: userId,
        name: userFullName,
        username: userHandle,
        email: userEmail,
        bio: userBio || null,
        image_url: imageUrl,
        is_active: true,
        is_verified: false,
        is_admin: false,
        is_banned: false,
        last_active: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = fullName.trim();
    const cleanUser = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanBio = bio.trim();

    if (cleanName.length < 2) {
      setErrorMsg('يرجى إدخال اسمك الكامل (حرفين على الأقل).');
      return;
    }
    if (usernameStatus === 'invalid' || cleanUser.length < 3) {
      setErrorMsg('اسم المستخدم يجب أن يتكون من 3 إلى 20 حرفاً إنجليزياً أو أرقاماً.');
      return;
    }
    if (usernameStatus === 'taken') {
      setErrorMsg('اسم المستخدم محجوز بالفعل، اختر اسماً آخر.');
      return;
    }
    if (!cleanEmail.includes('@') || emailStatus === 'taken') {
      setErrorMsg(
        emailStatus === 'taken'
          ? 'هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول.'
          : 'يرجى إدخال بريد إلكتروني صحيح.'
      );
      return;
    }
    if (password.length < 8) {
      setErrorMsg('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('كلمتا المرور غير متطابقتين.');
      return;
    }
    if (!acceptTerms) {
      setErrorMsg('يرجى الموافقة على شروط الاستخدام وسياسة الخصوصية.');
      return;
    }

    setIsLoading(true);
    setLoadingLabel('جاري إنشاء الحساب وإرسال رمز التحقق...');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            username: cleanUser,
            referred_by: referralCode || null,
          },
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          throw new Error('هذا البريد الإلكتروني مسجل مسبقاً. توجه لصفحة تسجيل الدخول.');
        }
        throw new Error(error.message);
      }

      if (data.session && data.user) {
        await createUserRecord(data.user.id, cleanName, cleanUser, cleanEmail, cleanBio);
        localStorage.setItem('cryptx_saved_identifier', cleanUser);
        setSuccessMsg('تم إنشاء حسابك بنجاح! جاري الدخول إلى Cryp X...');
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 700);
        return;
      }

      setOtpDigits(['', '', '', '', '', '']);
      setResendSeconds(60);
      setStep('verify-otp');
      setSuccessMsg(`تم إرسال رمز التحقق المكون من 6 أرقام إلى ${cleanEmail}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر إنشاء الحساب حالياً، حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleVerifyOtpCode = async (manualCode?: string) => {
    const code = manualCode || otpDigits.join('');
    if (code.length !== 6 || isLoading) return;

    setIsLoading(true);
    setLoadingLabel('جاري تأكيد الرمز وتفعيل الحساب...');
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanUser = username.trim().toLowerCase();
    const cleanBio = bio.trim();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: code,
        type: 'signup',
      });

      if (error || !data.user) {
        throw new Error('رمز التحقق غير صحيح أو منتهي الصلاحية. تأكد من الأرقام الستة.');
      }

      await createUserRecord(data.user.id, cleanName, cleanUser, cleanEmail, cleanBio);
      localStorage.setItem('cryptx_saved_identifier', cleanUser);

      setSuccessMsg('تم تفعيل حسابك بنجاح! مرحباً بك في Cryp X...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 750);
    } catch (err: any) {
      setErrorMsg(err.message);
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[idx] = digit;
    setOtpDigits(updated);

    if (digit && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }

    if (updated.join('').length === 6) {
      handleVerifyOtpCode(updated.join(''));
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const filled = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, i) => {
      filled[i] = ch;
    });
    setOtpDigits(filled);

    if (pasted.length === 6) {
      handleVerifyOtpCode(pasted);
    } else {
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (resendSeconds > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      setResendSeconds(60);
      setSuccessMsg('تم إرسال رمز تحقق جديد مكون من 6 أرقام إلى بريدك.');
    } catch {
      setErrorMsg('تعذر إعادة إرسال الرمز حالياً، انتظر قليلاً.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const strength = getPasswordStrength(password);

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[#09090b] text-zinc-100 flex flex-col lg:flex-row font-sans selection:bg-[#0ea5e9]/30 selection:text-white"
    >
      <aside className="hidden lg:flex lg:w-[44%] bg-[#0c0d10] border-l border-zinc-800/80 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#0ea5e9]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#0284c7]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0ea5e9] flex items-center justify-center text-white font-black text-xl shadow-sm">
              X
            </div>
            <span dir="ltr" className="text-2xl font-extrabold tracking-tight text-white">
              Cryp <span className="text-[#0ea5e9]">X</span>
            </span>
          </div>
          {serverPing && (
            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full">
              {serverPing}ms ●
            </span>
          )}
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-3xl font-bold text-white leading-snug">
            تواصل بحرية وخصوصية تامة في مساحة رقمية حديثة.
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            انضم إلى مجتمع Cryp X لمشاركة أفكارك، صورك، وقصصك اليومية مع حماية متقدمة للبيانات وتجربة استخدام سريعة وبسيطة.
          </p>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#0ea5e9]">
                ✓
              </div>
              <span>تشفير وحماية شاملة للحسابات والرسائل</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#0ea5e9]">
                ✓
              </div>
              <span>مشاركة المنشورات والقصص والفيديوهات القصيرة</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#0ea5e9]">
                ✓
              </div>
              <span>حسابات موثقة وإدارة مجتمعية احترافية</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-zinc-500">
          © {new Date().getFullYear()} Cryp X Inc. جميع الحقوق محفوظة.
        </div>
      </aside>

      <main className="flex-1 flex flex-col justify-between px-4 sm:px-8 py-6 sm:py-10 overflow-y-auto">
        <header className="w-full max-w-[440px] mx-auto flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-[#0ea5e9] flex items-center justify-center text-white font-black text-lg">
              X
            </div>
            <span dir="ltr" className="text-xl font-extrabold tracking-tight text-white">
              Cryp <span className="text-[#0ea5e9]">X</span>
            </span>
          </div>
          <div className="hidden lg:block" />
          <Link
            href="/sign-in"
            className="text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl transition-colors"
          >
            تسجيل الدخول
          </Link>
        </header>

        <div className="w-full max-w-[440px] mx-auto my-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {step === 'details' ? 'إنشاء حساب جديد' : 'التحقق من البريد الإلكتروني'}
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1.5">
              {step === 'details'
                ? 'أدخل بياناتك الأساسية للانضمام إلى منصة Cryp X'
                : 'أدخل الرمز المكون من 6 أرقام لتفعيل حسابك فوراً'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs sm:text-sm leading-relaxed">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs sm:text-sm leading-relaxed">
              {successMsg}
            </div>
          )}
          {step === 'details' && (
            <form onSubmit={handleSubmitRegistration} className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#121215] border border-zinc-800/80">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelectAvatar}
                  className="hidden"
                />
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-700 hover:border-[#0ea5e9] flex items-center justify-center cursor-pointer overflow-hidden shrink-0 transition-colors"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-xs font-semibold text-[#0ea5e9] hover:underline"
                  >
                    {avatarPreview ? 'تغيير الصورة الشخصية' : 'إضافة صورة للملف الشخصي'}
                  </button>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    اختياري — JPG أو PNG بحد أقصى 5MB
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="الاسم الذي سيظهر في ملفك الشخصي"
                  className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">اسم المستخدم</label>
                  {usernameStatus === 'checking' && (
                    <span className="text-[11px] text-zinc-400">جاري التحقق...</span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-[11px] text-emerald-400 font-medium">✓ متوفر</span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-[11px] text-red-400 font-medium">غير متوفر</span>
                  )}
                  {usernameStatus === 'invalid' && (
                    <span className="text-[11px] text-amber-400">أحرف إنجليزية وأرقام فقط</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                    placeholder="username"
                    className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 outline-none text-left transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                    @
                  </span>
                </div>

                {usernameSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-zinc-500">متاح:</span>
                    {usernameSuggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setUsername(sug)}
                        className="text-[11px] bg-zinc-900 hover:bg-zinc-800 text-[#38bdf8] border border-zinc-800 px-2.5 py-0.5 rounded-lg"
                      >
                        @{sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">البريد الإلكتروني</label>
                  {emailStatus === 'available' && (
                    <span className="text-[11px] text-emerald-400">✓ متاح</span>
                  )}
                  {emailStatus === 'taken' && (
                    <span className="text-[11px] text-red-400">مسجل مسبقاً</span>
                  )}
                </div>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 outline-none text-left transition-colors"
                />
                {emailSuggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(emailSuggestion);
                      setEmailSuggestion(null);
                    }}
                    className="mt-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-lg flex items-center gap-1.5 w-full"
                  >
                    <span>هل تقصد:</span>
                    <span dir="ltr" className="font-semibold underline text-white">
                      {emailSuggestion}
                    </span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  النبذة التعريفية (اختياري)
                </label>
                <input
                  type="text"
                  maxLength={140}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="اكتب وصفاً مختصراً عنك..."
                  className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">كلمة المرور</label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] text-[#0ea5e9] hover:underline"
                  >
                    اقتراح كلمة مرور قوية
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                    placeholder="8 أحرف على الأقل"
                    className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs"
                  >
                    {showPassword ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>

                {capsLockOn && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    ملاحظة: زر الأحرف الكبيرة (Caps Lock) مفعّل.
                  </p>
                )}

                {password && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((lvl) => (
                        <div
                          key={lvl}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            strength.score >= lvl
                              ? strength.score <= 1
                                ? 'bg-red-500'
                                : strength.score <= 2
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                              : 'bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2.5 text-[10px] text-zinc-500">
                      <span className={strength.rules.length ? 'text-emerald-400' : ''}>✓ 8+ أحرف</span>
                      <span className={strength.rules.length ? 'text-emerald-400' : ''}>✓ 8+ أحرف</span>
                      <span className={strength.rules.upper ? 'text-emerald-400' : ''}>✓ حرف كبير</span>
                      <span className={strength.rules.number ? 'text-emerald-400' : ''}>✓ رقم</span>
                      <span className={strength.rules.symbol ? 'text-emerald-400' : ''}>✓ رمز خاص</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  تأكيد كلمة المرور
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#0ea5e9]"
                />
                <span className="text-xs text-zinc-400">
                  أوافق على شروط الخدمة وسياسة الخصوصية في Cryp X
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading || usernameStatus === 'taken' || emailStatus === 'taken'}
                className="w-full mt-2 bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{loadingLabel}</span>
                  </>
                ) : (
                  <span>إنشاء الحساب</span>
                )}
              </button>
            </form>
          )}

          {step === 'verify-otp' && (
            <div className="space-y-5 bg-[#121215] border border-zinc-800 p-6 rounded-2xl">
              <div className="text-center">
                <h2 className="text-base font-bold text-white">أدخل رمز التفعيل</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  تم إرسال رمز مكون من 6 أرقام إلى بريدك الإلكتروني:
                  <span dir="ltr" className="block text-[#0ea5e9] font-medium mt-1">
                    {email}
                  </span>
                </p>
              </div>

              <div dir="ltr" onPaste={handleOtpPaste} className="grid grid-cols-6 gap-2 my-4">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-full h-12 text-center text-lg font-bold bg-[#09090b] border border-zinc-700 focus:border-[#0ea5e9] rounded-xl text-white outline-none transition-colors"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleVerifyOtpCode()}
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {isLoading ? loadingLabel : 'تأكيد الرمز والمتابعة'}
              </button>

              <div className="flex items-center justify-between text-xs pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendSeconds > 0}
                  className="text-[#0ea5e9] disabled:text-zinc-500 hover:underline"
                >
                  {resendSeconds > 0 ? `إعادة الإرسال بعد ${resendSeconds} ثانية` : 'إعادة إرسال الرمز'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setStep('details');
                  }}
                  className="text-zinc-400 hover:text-white"
                >
                  تعديل البريد
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="w-full max-w-[440px] mx-auto mt-8 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Cryp X © {new Date().getFullYear()}</span>
          <span>الخصوصية · الشروط · الأمان</span>
        </footer>
      </main>
    </div>
  );
}
