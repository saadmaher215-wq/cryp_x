'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider, useUserContext } from '../../src/context/SupabaseAuthContext';
import { CrypXProvider, useCrypX } from '../../src/context/CrypXContext';
import { createClient } from '../../src/lib/supabase/client';

function CrypXShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();
  const { user, isLoading: authLoading } = useUserContext();
  const {
    lang,
    toggleLang,
    t,
    unreadNotifs,
    unreadMsgs,
    lockdownMode,
    broadcastBanner,
    isFounderOrAdmin,
  } = useCrypX();

  const [dbAvatar, setDbAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setDbAvatar(null);
      return;
    }
    supabase
      .from('users')
      .select('image_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.image_url) {
          setDbAvatar(data.image_url);
        }
      });
  }, [user?.id]);

  const isAuthPage =
    pathname?.startsWith('/sign-in') ||
    pathname?.startsWith('/sign-up') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/verify-otp') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/staff');

  if (isAuthPage) {
    return <>{children}</>;
  }

  const isFounderEmail =
    user?.email?.toLowerCase() === 'saadmaher0592@gmail.com' ||
    user?.username?.toLowerCase() === 'xxx';

  if (lockdownMode && !authLoading && !isFounderOrAdmin && !isFounderEmail) {
    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-[#050507] text-white flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 flex items-center justify-center mb-5">
          <span className="text-3xl font-black text-[#0ea5e9]">!</span>
        </div>
        <h1 className="text-xl font-extrabold mb-2">
          {t('وضع الحماية والصيانة مفعّل حالياً', 'System Under Protective Maintenance')}
        </h1>
        <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
          {t(
            'تقوم إدارة Cryp X حالياً بإجراء تحديثات أمنية شاملة. سنعود للعمل خلال دقائق قليلة.',
            'Cryp X security team is performing scheduled maintenance. We will be back shortly.'
          )}
        </p>
      </div>
    );
  }

  const finalAvatar = dbAvatar || user?.imageUrl || null;

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#000000] text-zinc-100 flex flex-col">
      {broadcastBanner && (
        <div className="bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#0284c7] text-white text-xs font-bold py-2 px-4 text-center z-50">
          {broadcastBanner}
        </div>
      )}

      {!pathname?.startsWith('/profile') && (
        <header className="sticky top-0 z-40 h-14 bg-[#000000]/90 backdrop-blur-xl border-b border-zinc-900/90 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative p-1.5 text-zinc-200 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#0ea5e9] ring-2 ring-black" />
              )}
            </Link>

            <button
              type="button"
              onClick={toggleLang}
              className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] font-bold text-zinc-300 hover:text-white"
            >
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
          </div>

          <Link href="/" className="flex items-center gap-1.5 select-none">
            <span className="text-xl font-black tracking-tight text-white">
              Cryp <span className="text-[#0ea5e9]">X</span>
            </span>
            <span className="w-5 h-5 rounded-md bg-[#0ea5e9] text-white text-xs font-black flex items-center justify-center shadow-[0_0_12px_rgba(14,165,233,0.6)]">
              X
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/create-post"
              aria-label="Create"
              className="p-1.5 text-zinc-200 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>
        </header>
      )}

      <main className="flex-1 w-full max-w-xl mx-auto pb-24">{children}</main>

      <div className="fixed bottom-3 inset-x-0 z-50 px-4 pointer-events-none">
        <nav className="max-w-md mx-auto h-14 bg-[#111317]/90 backdrop-blur-2xl border border-zinc-800/90 rounded-full px-5 flex items-center justify-between shadow-[0_10px_35px_rgba(0,0,0,0.85)] pointer-events-auto">
          <Link
            href="/"
            aria-label="Home"
            className={`p-2 rounded-2xl transition-all ${
              pathname === '/'
                ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={pathname === '/' ? 2.4 : 1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Link>

          <Link
            href="/explore"
            aria-label="Search"
            className={`p-2 rounded-2xl transition-all ${
              pathname?.startsWith('/explore')
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={pathname?.startsWith('/explore') ? 2.4 : 1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>

          <Link
            href="/reels"
            aria-label="Reels"
            className={`p-2 rounded-2xl transition-all ${
              pathname?.startsWith('/reels')
                ? 'bg-[#0ea5e9]/20 text-[#38bdf8] shadow-[0_0_18px_rgba(14,165,233,0.45)]'
                : 'text-[#0ea5e9] hover:bg-[#0ea5e9]/10'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </Link>

          <Link
            href="/messages"
            aria-label="Messages"
            className={`relative p-2 rounded-2xl transition-all ${
              pathname?.startsWith('/messages')
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={pathname?.startsWith('/messages') ? 2.4 : 1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {unreadMsgs > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#0ea5e9] text-white text-[10px] font-black flex items-center justify-center">
                {unreadMsgs}
              </span>
            )}
          </Link>

          <Link
            href={user?.id ? `/profile/${user.id}` : '/sign-in'}
            aria-label="Profile"
            className="p-1 rounded-full transition-transform active:scale-95"
          >
            {finalAvatar ? (
              <img
                src={finalAvatar}
                alt="Profile"
                className={`w-7 h-7 rounded-full object-cover border-2 ${
                  pathname?.startsWith('/profile')
                    ? 'border-[#0ea5e9] shadow-[0_0_12px_rgba(14,165,233,0.7)]'
                    : 'border-zinc-600'
                }`}
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                  pathname?.startsWith('/profile')
                    ? 'border-[#0ea5e9] bg-[#0ea5e9]/15 text-[#38bdf8]'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </Link>
        </nav>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CrypXProvider>
        <CrypXShell>{children}</CrypXShell>
      </CrypXProvider>
    </AuthProvider>
  );
}
