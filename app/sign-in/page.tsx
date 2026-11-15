'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type AuthMode = 'password' | 'otp' | 'forgot';

export default function CrypXEnterpriseSignIn() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<AuthMode>('password');
  const [serverPing, setServerPing] = useState<number | null>(null);
  const [detectedRegion, setDetectedRegion] = useState<string>('Global');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [accountPreview, setAccountPreview] = useState<{
    name: string;
    avatar: string;
  } | null>(null);

  const [otpSent, setOtpSent] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('جاري التحقق...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cryptx_saved_identifier');
      if (saved) setIdentifier(saved);

      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
          const city = tz.split('/').pop()?.replace(/_/g, ' ');
          if (city) setDetectedRegion(city);
        }
      } catch {
        setDetectedRegion('Global');
      }
    }

    const pingServer = async () => {
      const t0 = performance.now();
      try {
        await supabase.from('users').select('id').limit(1);
        setServerPing(Math.max(10, Math.round(performance.now() - t0)));
      } catch {
        setServerPing(null);
      }
    };
    pingServer();
  }, []);

  useEffect(() => {
    const clean = identifier.trim().toLowerCase();
    if (clean.length < 3) {
      setAccountPreview(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc('resolve_login_email', {
          identifier_input: clean,
        });
        if (!cancelled && data && data.found && data.name) {
          setAccountPreview({
            name: data.name,
            avatar:
              data.avatar ||
              'https://ui-avatars.com' +
                encodeURIComponent(data.name),
          });
        } else if (!cancelled) {
          setAccountPreview(null);
        }
      } catch {
        if (!cancelled) setAccountPreview(null);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [identifier]);

  useEffect(() => {
    if (otpExpirySeconds <= 0) return;
    const timer = setInterval(() => {
      setOtpExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpExpirySeconds]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);
  const lookupTargetEmail = async (rawInput: string): Promise<string> => {
    const clean = rawInput.trim().toLowerCase();
    const { data, error } = await supabase.rpc('resolve_login_email', {
      identifier_input: clean,
    });

    if (!error && data && data.email) {
      return data.email;
    }

    if (clean.includes('@')) {
      return clean;
    }

    throw new Error('لم يتم العثور على حساب مرتبط باسم المستخدم هذا.');
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMsg('يرجى إدخال اسم المستخدم أو البريد الإلكتروني.');
      return;
    }
    if (!password) {
      setErrorMsg('يرجى إدخال كلمة المرور.');
      return;
    }

    setIsLoading(true);
    setLoadingLabel('جاري تسجيل الدخول...');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const targetEmail = await lookupTargetEmail(cleanId);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      if (error || !data.user) {
        throw new Error('بيانات الدخول غير صحيحة. تأكد من كلمة المرور أو استخدم رمز التحقق.');
      }

      if (rememberMe) {
        localStorage.setItem('cryptx_saved_identifier', cleanId);
      } else {
        localStorage.removeItem('cryptx_saved_identifier');
      }

      setSuccessMsg('تم تسجيل الدخول بنجاح! جاري التوجيه إلى Cryp X...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 450);
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر تسجيل الدخول حالياً.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading || resendSeconds > 0) return;

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMsg('أدخل اسم المستخدم أو البريد الإلكتروني أولاً.');
      return;
    }

    setIsLoading(true);
    setLoadingLabel('جاري إرسال رمز التحقق...');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const targetEmail = await lookupTargetEmail(cleanId);
      const { error } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: { shouldCreateUser: false },
      });

      if (error) {
        throw new Error('تعذر إرسال الرمز. تأكد من صحة البريد الإلكتروني أو انتظر قليلاً.');
      }

      setResolvedEmail(targetEmail);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpExpirySeconds(60);
      setResendSeconds(90);
      setOtpSent(true);
      setSuccessMsg(`تم إرسال رمز مكون من 6 أرقام إلى ${targetEmail}`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (manualCode?: string) => {
    const code = manualCode || otpDigits.join('');
    if (code.length !== 6 || isLoading) return;

    setIsLoading(true);
    setLoadingLabel('جاري تأكيد الرمز...');
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: resolvedEmail,
        token: code,
        type: 'email',
      });

      if (error || !data.user) {
        throw new Error('رمز التحقق غير صحيح أو انتهت صلاحيته (60 ثانية).');
      }

      if (rememberMe) {
        localStorage.setItem('cryptx_saved_identifier', identifier.trim());
      }

      setSuccessMsg('تم التحقق بنجاح! مرحباً بعودتك إلى Cryp X...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 450);
    } catch (err: any) {
      setErrorMsg(err.message);
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current.at(0)?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMsg('أدخل اسم المستخدم أو البريد الإلكتروني لاستعادة كلمة المرور.');
      return;
    }

    setIsLoading(true);
    setLoadingLabel('جاري إرسال رابط الاستعادة...');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const targetEmail = await lookupTargetEmail(cleanId);
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      setSuccessMsg(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${targetEmail}`);
    } catch (err: any) {
      setErrorMsg(err.message);
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
      handleVerifyOtp(updated.join(''));
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
      handleVerifyOtp(pasted);
    } else {
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
            <span>{detectedRegion}</span>
            {serverPing && <span className="text-emerald-400">· {serverPing}ms</span>}
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-3xl font-bold text-white leading-snug">
            مرحباً بعودتك إلى مجتمع Cryp X الرقمي.
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            سجّل الدخول لمتابعة أصدقائك، استكشاف أحدث المنشورات والقصص، والتواصل بأمان وخصوصية تامة.
          </p>
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
            href="/sign-up"
            className="text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl transition-colors"
          >
            إنشاء حساب جديد
          </Link>
        </header>

        <div className="w-full max-w-[440px] mx-auto my-auto">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {mode === 'forgot' ? 'استعادة الحساب' : 'تسجيل الدخول'}
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1.5">
              {mode === 'password' && 'أدخل اسم المستخدم أو البريد الإلكتروني وكلمة المرور'}
              {mode === 'otp' && 'سجّل الدخول فوراً برمز تحقق مكون من 6 أرقام'}
              {mode === 'forgot' && 'سنرسل رابطاً آمناً لإعادة تعيين كلمة المرور'}
            </p>
          </div>

          {accountPreview && (
            <div className="mb-5 p-3 rounded-2xl bg-[#121215] border border-zinc-800 flex items-center gap-3">
              <img
                src={accountPreview.avatar}
                alt={accountPreview.name}
                className="w-10 h-10 rounded-full object-cover border border-[#0ea5e9]/40"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{accountPreview.name}</p>
                <p className="text-[11px] text-emerald-400">✓ تم التعرف على الحساب</p>
              </div>
            </div>
          )}

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

          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username or email@example.com"
                  className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 outline-none text-left transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">كلمة المرور</label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setMode('forgot');
                    }}
                    className="text-[11px] text-[#0ea5e9] hover:underline"
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
                    placeholder="••••••••"
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
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#0ea5e9]"
                  />
                  <span className="text-xs text-zinc-400">تذكر بياناتي</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setOtpSent(false);
                    setMode('otp');
                  }}
                  className="text-xs text-[#0ea5e9] hover:underline font-medium"
                >
                  الدخول برمز تحقق (OTP)
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{loadingLabel}</span>
                  </>
                ) : (
                  <span>تسجيل الدخول</span>
                )}
              </button>
            </form>
          )}
          {mode === 'otp' && !otpSent && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username or email@example.com"
                  className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 outline-none text-left transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors"
              >
                {isLoading ? loadingLabel : 'إرسال رمز التحقق'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setMode('password');
                }}
                className="w-full text-xs text-zinc-400 hover:text-white py-2"
              >
                العودة للدخول بكلمة المرور
              </button>
            </form>
          )}

          {mode === 'otp' && otpSent && (
            <div className="space-y-5 bg-[#121215] border border-zinc-800 p-6 rounded-2xl">
              <div className="text-center">
                <h2 className="text-base font-bold text-white">أدخل رمز الدخول</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  تم إرسال رمز مكون من 6 أرقام إلى:
                  <span dir="ltr" className="block text-[#0ea5e9] font-medium mt-1">
                    {resolvedEmail}
                  </span>
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-[11px]">
                  {otpExpirySeconds > 0 ? (
                    <span className="text-emerald-400 font-mono">
                      صلاحية الرمز تنتهي خلال: {otpExpirySeconds} ثانية
                    </span>
                  ) : (
                    <span className="text-red-400">انتهت صلاحية الرمز، اطلب رمزاً جديداً</span>
                  )}
                </div>
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
                onClick={() => handleVerifyOtp()}
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {isLoading ? loadingLabel : 'تأكيد الرمز والدخول'}
              </button>

              <div className="flex items-center justify-between text-xs pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={resendSeconds > 0}
                  className="text-[#0ea5e9] disabled:text-zinc-500 hover:underline"
                >
                  {resendSeconds > 0
                    ? `إعادة الإرسال بعد ${resendSeconds} ثانية (دقيقة ونصف)`
                    : 'إعادة إرسال الرمز'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setMode('password');
                  }}
                  className="text-zinc-400 hover:text-white"
                >
                  تغيير الطريقة
                </button>
              </div>
            </div>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username or email@example.com"
                  className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 outline-none text-left transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors"
              >
                {isLoading ? loadingLabel : 'إرسال رابط الاستعادة'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setMode('password');
                }}
                className="w-full text-xs text-zinc-400 hover:text-white py-2"
              >
                العودة لتسجيل الدخول
              </button>
            </form>
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
