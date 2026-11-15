'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type AuthScreenMode =
  | 'password-login'
  | 'otp-login-request'
  | 'otp-login-verify'
  | 'forgot-password-request'
  | 'forgot-password-reset'
  | 'account-banned'
  | 'appeal-submitted';

interface AccountPreview {
  name: string | null;
  username: string;
  image_url: string | null;
  is_verified: boolean;
  is_admin: boolean;
}

export default function CryptXEnterpriseSignIn() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<AuthScreenMode>('password-login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const [accountPreview, setAccountPreview] = useState<AccountPreview | null>(null);
  const [isCheckingPreview, setIsCheckingPreview] = useState(false);
  const [serverLatency, setServerLatency] = useState<number | null>(null);

  const [targetEmail, setTargetEmail] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendTimer, setResendTimer] = useState(0);

  const [banReason, setBanReason] = useState<string | null>(null);
  const [appealMessage, setAppealMessage] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    setMounted(true);
    const savedUser = localStorage.getItem('cryptx_saved_identifier');
    if (savedUser) {
      setIdentifier(savedUser);
    }

    const checkPing = async () => {
      const start = performance.now();
      try {
        await supabase.from('users').select('id').limit(1);
        const end = performance.now();
        setServerLatency(Math.max(12, Math.round(end - start)));
      } catch {
        setServerLatency(null);
      }
    };
    checkPing();
  }, []);

  useEffect(() => {
    const clean = identifier.trim().replace(/^@/, '');
    if (clean.length < 3) {
      setAccountPreview(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsCheckingPreview(true);
      try {
        const isEmail = clean.includes('@');
        const query = supabase
          .from('users')
          .select('name, username, image_url, is_verified, is_admin');

        const { data } = isEmail
          ? await query.ilike('email', clean).maybeSingle()
          : await query.ilike('username', clean).maybeSingle();

        setAccountPreview(data || null);
      } catch {
        setAccountPreview(null);
      } finally {
        setIsCheckingPreview(false);
      }
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [identifier]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const resolveAccountInfo = async (rawInput: string) => {
    const cleanInput = rawInput.trim().replace(/^@/, '');
    if (!cleanInput) {
      throw new Error('يرجى إدخال اسم المستخدم أو البريد الإلكتروني.');
    }

    const isEmail = cleanInput.includes('@');
    const query = supabase
      .from('users')
      .select('id, email, username, is_banned, ban_reason');

    const { data, error } = isEmail
      ? await query.ilike('email', cleanInput).maybeSingle()
      : await query.ilike('username', cleanInput).maybeSingle();

    if (error) {
      throw new Error('تعذر الاتصال بقاعدة البيانات، يرجى المحاولة بعد قليل.');
    }

    if (!data && !isEmail) {
      throw new Error('اسم المستخدم غير مسجل لدينا. تأكد من كتابته أو سجّل ببريدك الإلكتروني.');
    }

    if (data?.is_banned) {
      setTargetUserId(data.id);
      setBanReason(data.ban_reason || 'مخالفة شروط وسياسات الأمان في منصة CryptX.');
      setMode('account-banned');
      throw new Error('ACCOUNT_BANNED');
    }

    return {
      id: data?.id || null,
      email: (data?.email || cleanInput).toLowerCase(),
    };
  };

  const completeLoginSession = async (userId: string) => {
    const { data: profile } = await supabase
      .from('users')
      .select('is_banned, ban_reason, is_deactivated')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.is_banned) {
      await supabase.auth.signOut();
      setTargetUserId(userId);
      setBanReason(profile.ban_reason || 'تم تقييد هذا الحساب من قبل الإدارة.');
      setMode('account-banned');
      return;
    }

    await supabase
      .from('users')
      .update({
        is_deactivated: false,
        is_active: true,
        last_active: new Date().toISOString(),
      })
      .eq('id', userId);

    if (rememberMe && identifier.trim()) {
      localStorage.setItem('cryptx_saved_identifier', identifier.trim());
    } else {
      localStorage.removeItem('cryptx_saved_identifier');
    }

    setSuccessMsg('تم تأكيد هويتك بنجاح! جاري فتح مساحتك المشفرة...');
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 700);
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0 || isLoading) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    if (!identifier.trim() || !password) {
      setErrorMsg('يرجى إدخال اسم المستخدم (أو البريد) وكلمة المرور.');
      return;
    }

    setIsLoading(true);
    try {
      const account = await resolveAccountInfo(identifier);
      setTargetEmail(account.email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          await supabase.auth.resend({ type: 'signup', email: account.email });
          setOtpDigits(['', '', '', '', '', '']);
          setResendTimer(60);
          setMode('otp-login-verify');
          setSuccessMsg(`حسابك بانتظار التفعيل. أرسلنا رمزاً من 6 أرقام إلى ${account.email}`);
          return;
        }

        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        if (attempts >= 5) {
          setLockoutSeconds(30);
          throw new Error('تم قفل المحاولات لمدة 30 ثانية لحماية حسابك من الاختراق.');
        }
        throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
      }

      if (data.user) {
        await completeLoginSession(data.user.id);
      }
    } catch (err: any) {
      if (err.message !== 'ACCOUNT_BANNED') {
        setErrorMsg(err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const account = await resolveAccountInfo(identifier);
      setTargetEmail(account.email);

      const { error } = await supabase.auth.signInWithOtp({
        email: account.email,
        options: { shouldCreateUser: false },
      });

      if (error) {
        throw new Error('تعذر إرسال رمز الدخول. تأكد من أن الحساب مسجل مسبقاً.');
      }

      setOtpDigits(['', '', '', '', '', '']);
      setResendTimer(60);
      setMode('otp-login-verify');
      setSuccessMsg('تم إرسال رمز الدخول المكون من 6 أرقام إلى بريدك الإلكتروني.');
    } catch (err: any) {
      if (err.message !== 'ACCOUNT_BANNED') {
        setErrorMsg(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };
  const handleVerifyLoginOtp = async (manualCode?: string) => {
    const code = manualCode || otpDigits.join('');
    if (code.length !== 6 || isLoading) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: code,
        type: 'email',
      });

      if (error) {
        const resSignup = await supabase.auth.verifyOtp({
          email: targetEmail,
          token: code,
          type: 'signup',
        });
        data = resSignup.data;
        error = resSignup.error;
      }

      if (error || !data.user) {
        throw new Error('الرمز غير صحيح أو منتهي الصلاحية. حاول مرة أخرى.');
      }

      await completeLoginSession(data.user.id);
    } catch (err: any) {
      setErrorMsg(err.message);
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPasswordResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const account = await resolveAccountInfo(identifier);
      setTargetEmail(account.email);

      const { error } = await supabase.auth.resetPasswordForEmail(account.email);
      if (error) {
        throw new Error('تعذر إرسال رمز الاستعادة حالياً. يرجى المحاولة بعد دقيقة.');
      }

      setOtpDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmNewPassword('');
      setResendTimer(60);
      setMode('forgot-password-reset');
      setSuccessMsg(`أرسلنا رمز الاستعادة المكون من 6 أرقام إلى ${account.email}`);
    } catch (err: any) {
      if (err.message !== 'ACCOUNT_BANNED') {
        setErrorMsg(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');

    if (code.length !== 6) {
      setErrorMsg('يرجى إدخال الرمز المكون من 6 أرقام كاملاً.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('كلمتا المرور غير متطابقتين.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: code,
        type: 'recovery',
      });

      if (verifyError || !data.user) {
        throw new Error('رمز الاستعادة غير صحيح أو انتهت صلاحيته.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error('تعذر تحديث كلمة المرور. جرب كلمة مرور أقوى.');
      }

      setSuccessMsg('تم تغيير كلمة المرور بنجاح! جاري تسجيل دخولك...');
      await completeLoginSession(data.user.id);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitBanAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealMessage.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (targetUserId) {
        await supabase.from('support_tickets').insert({
          user_id: targetUserId,
          subject: 'طلب استئناف ومراجعة حظر حساب',
          message: appealMessage.trim(),
          status: 'open',
        });
      }
      setMode('appeal-submitted');
    } catch {
      setErrorMsg('تعذر إرسال الطلب حالياً، يرجى المحاولة لاحقاً.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpInput = (idx: number, val: string) => {
    const cleanDigit = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[idx] = cleanDigit;
    setOtpDigits(updated);

    if (cleanDigit && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }

    if (mode === 'otp-login-verify' && updated.join('').length === 6) {
      handleVerifyLoginOtp(updated.join(''));
    }
  };

  const handleOtpBackspace = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
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

    if (pasted.length === 6 && mode === 'otp-login-verify') {
      handleVerifyLoginOtp(pasted);
    } else {
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (mode === 'forgot-password-reset') {
        await supabase.auth.resetPasswordForEmail(targetEmail);
      } else {
        await supabase.auth.signInWithOtp({
          email: targetEmail,
          options: { shouldCreateUser: false },
        });
      }
      setResendTimer(60);
      setSuccessMsg('تم إرسال رمز جديد مكون من 6 أرقام إلى بريدك.');
    } catch {
      setErrorMsg('تعذر إعادة إرسال الرمز حالياً.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#05070a] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const strengthScore = getPasswordStrength(newPassword);

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[#05070a] text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-[#0ea5e9]/30 selection:text-[#38bdf8]"
    >
      <div className="pointer-events-none absolute -top-40 -right-40 w-[450px] h-[450px] rounded-full bg-[#0ea5e9]/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 w-[450px] h-[450px] rounded-full bg-[#0284c7]/10 blur-[130px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <header className="w-full max-w-6xl mx-auto px-5 pt-5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 bg-[#0d1117]/90 border border-[#1e293b] px-3.5 py-1.5 rounded-full text-xs text-slate-300 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>تشفير تام من طرف إلى طرف (E2EE)</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono bg-[#0d1117]/80 border border-[#1e293b] px-3 py-1 rounded-full">
          <span>{serverLatency ? `${serverLatency}ms` : 'TLS 1.3'}</span>
          <span className="text-[#0ea5e9]">●</span>
        </div>
      </header>

      <main className="w-full max-w-[445px] mx-auto px-5 py-6 relative z-10 flex flex-col items-center">
        <div className="text-center mb-6 select-none">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0ea5e9]/20 to-[#0284c7]/5 border border-[#0ea5e9]/30 shadow-[0_0_35px_rgba(14,165,233,0.18)] mb-3.5">
            <svg
              className="w-8 h-8 text-[#0ea5e9]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>

          <h1
            dir="ltr"
            className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center justify-center"
          >
            <span>Crypt</span>
            <span className="text-[#0ea5e9] drop-shadow-[0_0_18px_rgba(14,165,233,0.55)]">X</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-2 font-medium">
            منصة التواصل المشفر والخصوصية
          </p>
        </div>

        {accountPreview && mode === 'password-login' && (
          <div className="w-full mb-3.5 bg-[#0d1420]/90 border border-[#0ea5e9]/30 rounded-2xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0ea5e9] to-[#0284c7] flex items-center justify-center text-sm font-bold text-white overflow-hidden">
                {accountPreview.image_url ? (
                  <img
                    src={accountPreview.image_url}
                    alt={accountPreview.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(accountPreview.name || accountPreview.username).charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">
                    {accountPreview.name || accountPreview.username}
                  </span>
                  {accountPreview.is_verified && (
                                        <svg className="w-3.5 h-3.5 text-[#0ea5e9]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <span dir="ltr" className="text-[11px] text-slate-400 block text-right">
                  @{accountPreview.username}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              حساب موثوق
            </span>
          </div>
        )}

        <div className="w-full bg-[#0b0f17]/95 backdrop-blur-xl border border-[#1e293b] rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.8)]">
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-2.5 leading-relaxed">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5 leading-relaxed">
              <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'password-login' && (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <label className="text-xs font-medium text-slate-400">
                    اسم المستخدم أو البريد الإلكتروني
                  </label>
                  {isCheckingPreview && (
                    <span className="text-[11px] text-[#0ea5e9]">جاري التحقق...</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="مثال: saad أو name@email.com"
                    autoComplete="username"
                    className="w-full bg-[#111827] border border-[#1f2937] focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <label className="text-xs font-medium text-slate-400">كلمة المرور</label>
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setMode('forgot-password-request');
                    }}
                    className="text-xs text-[#38bdf8] hover:text-[#0ea5e9] transition-colors"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full bg-[#111827] border border-[#1f2937] focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    aria-label="إظهار أو إخفاء كلمة المرور"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {capsLockOn && (
                  <p className="text-[11px] text-amber-400 mt-1.5 mr-1">
                    تنبيه: زر الأحرف الكبيرة (Caps Lock) مفعّل في لوحة المفاتيح.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-[#111827] text-[#0ea5e9] focus:ring-[#0ea5e9]"
                  />
                  <span className="text-xs text-slate-400">حفظ اسم المستخدم</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setMode('otp-login-request');
                  }}
                  className="text-xs font-medium text-slate-300 hover:text-[#38bdf8] transition-colors"
                >
                  الدخول برمز تحقق (OTP)
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || lockoutSeconds > 0}
                className="w-full mt-2 bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] hover:from-[#38bdf8] hover:to-[#0ea5e9] disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl shadow-[0_8px_25px_rgba(14,165,233,0.35)] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جاري المصادقة...</span>
                  </>
                ) : lockoutSeconds > 0 ? (
                  <span>مقفل أمنياً ({lockoutSeconds} ثانية)</span>
                ) : (
                  <span>تسجيل الدخول</span>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#1e293b]" />
                <span className="flex-shrink mx-3 text-xs text-slate-500">ليس لديك حساب؟</span>
                <div className="flex-grow border-t border-[#1e293b]" />
              </div>

              <Link
                href="/sign-up"
                className="w-full block text-center bg-[#151c28] hover:bg-[#1e293b] border border-[#263244] text-slate-200 font-semibold py-3.5 px-4 rounded-2xl transition-all text-sm"
              >
                إنشاء حساب جديد
              </Link>
            </form>
          )}
          {mode === 'otp-login-request' && (
            <form onSubmit={handleSendLoginOtp} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-white">الدخول بدون كلمة مرور</h2>
                <p className="text-xs text-slate-400 mt-1">
                  أدخل اسم المستخدم أو البريد الإلكتروني وسنرسل لك رمز دخول فوري من 6 أرقام
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 mr-1">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
                  className="w-full bg-[#111827] border border-[#1f2937] focus:border-[#0ea5e9] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] text-white font-bold py-3.5 rounded-2xl shadow-[0_8px_25px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>إرسال رمز التحقق (6 أرقام)</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setMode('password-login');
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-white pt-2"
              >
                العودة للدخول بكلمة المرور
              </button>
            </form>
          )}

          {mode === 'otp-login-verify' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 text-[#0ea5e9] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white">أدخل رمز التحقق</h2>
                <p className="text-xs text-slate-400 mt-1">
                  أدخل الرمز المكون من 6 أرقام المرسل إلى:
                  <span dir="ltr" className="block text-[#38bdf8] font-mono mt-0.5">
                    {targetEmail}
                  </span>
                </p>
              </div>

              <div dir="ltr" onPaste={handleOtpPaste} className="grid grid-cols-6 gap-2 sm:gap-2.5 my-4">
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
                    onChange={(e) => handleOtpInput(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpBackspace(idx, e)}
                    className="w-full h-12 sm:h-14 text-center text-xl font-bold bg-[#111827] border border-[#1f2937] focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/30 rounded-xl text-white outline-none transition-all"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleVerifyLoginOtp()}
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-[0_8px_25px_rgba(14,165,233,0.3)]"
              >
                {isLoading ? 'جاري التحقق...' : 'تأكيد الرمز والدخول'}
              </button>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0}
                  className="text-[#38bdf8] disabled:text-slate-500 hover:underline"
                >
                  {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إعادة إرسال الرمز'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setMode('password-login');
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  رجوع
                </button>
              </div>
            </div>
          )}

          {mode === 'forgot-password-request' && (
            <form onSubmit={handleRequestPasswordResetOtp} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-white">استعادة كلمة المرور</h2>
                <p className="text-xs text-slate-400 mt-1">
                  أدخل اسم المستخدم أو البريد الإلكتروني وسنرسل لك رمزاً لإعادة تعيين كلمة المرور
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 mr-1">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
                  className="w-full bg-[#111827] border border-[#1f2937] focus:border-[#0ea5e9] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] text-white font-bold py-3.5 rounded-2xl shadow-[0_8px_25px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>إرسال رمز الاستعادة</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setMode('password-login');
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-white pt-2"
              >
                العودة لتسجيل الدخول
              </button>
            </form>
          )}

          {mode === 'forgot-password-reset' && (
            <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">تعيين كلمة مرور جديدة</h2>
                <p className="text-xs text-slate-400 mt-1">
                  أدخل الرمز المرسل إلى <span className="text-[#38bdf8]">{targetEmail}</span> ثم اختر كلمة مرور قوية
                </p>
              </div>

              <div dir="ltr" onPaste={handleOtpPaste} className="grid grid-cols-6 gap-2 my-3">
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
                    onChange={(e) => handleOtpInput(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpBackspace(idx, e)}
                    className="w-full h-11 text-center text-lg font-bold bg-[#111827] border border-[#1f2937] focus:border-[#0ea5e9] rounded-xl text-white outline-none"
                  />
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 mr-1">
                  كلمة المرور الجديدة (8 أحرف على الأقل)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#111827] border border-[#1f2937] focus:border-[#0ea5e9] rounded-2xl px-4 py-3 text-sm text-white outline-none"
                />
                {newPassword && (
                  <div className="flex gap-1.5 mt-2 px-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          strengthScore >= level
                            ? strengthScore <= 1
                              ? 'bg-red-500'
                              : strengthScore <= 2
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                            : 'bg-[#1f2937]'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 mr-1">
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#111827] border border-[#1f2937] focus:border-[#0ea5e9] rounded-2xl px-4 py-3 text-sm text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] text-white font-bold py-3.5 rounded-2xl shadow-[0_8px_25px_rgba(14,165,233,0.3)]"
              >
                {isLoading ? 'جاري التحديث...' : 'حفظ كلمة المرور والدخول'}
              </button>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0}
                  className="text-[#38bdf8] disabled:text-slate-500"
                >
                  {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إعادة إرسال الرمز'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('password-login')}
                  className="text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {mode === 'account-banned' && (
            <form onSubmit={handleSubmitBanAppeal} className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-red-400">هذا الحساب محظور من الإدارة</h2>
              <p className="text-xs text-slate-300 bg-[#111827] border border-red-500/20 p-3 rounded-xl leading-relaxed">
                السبب: {banReason}
              </p>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 mr-1">
                  هل تعتقد أن الحظر تم بالخطأ؟ أرسل توضيحاً لإدارة CryptX:
                </label>
                <textarea
                  rows={3}
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                  placeholder="اكتب رسالتك هنا لتصل مباشرة إلى غرفة الدعم الفني..."
                  className="w-full bg-[#111827] border border-[#1f2937] focus:border-[#0ea5e9] rounded-xl p-3 text-xs text-white outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !appealMessage.trim()}
                className="w-full bg-[#0ea5e9] hover:bg-[#38bdf8] disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl transition-all"
              >
                {isLoading ? 'جاري إرسال الطلب...' : 'إرسال طلب استئناف للإدارة'}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setMode('password-login');
                }}
                className="w-full text-xs text-slate-400 hover:text-white pt-1"
              >
                العودة لشاشة الدخول
              </button>
            </form>
          )}

          {mode === 'appeal-submitted' && (
            <div className="text-center space-y-4 py-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">تم استلام طلبك بنجاح</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                وصلت رسالتك إلى فريق إدارة CryptX وستتم مراجعتها والرد عليك في أقرب وقت.
              </p>
              <button
                type="button"
                onClick={() => setMode('password-login')}
                className="w-full bg-[#151c28] text-white text-xs font-semibold py-3 rounded-xl border border-[#263244]"
              >
                العودة للرئيسية
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-5 pb-5 text-center text-xs text-slate-500 relative z-10">
        <p>© {new Date().getFullYear()} CryptX — جميع المحادثات والبيانات محمية بتشفير متقدم</p>
      </footer>
    </div>
  );
}

