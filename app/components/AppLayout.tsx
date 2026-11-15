'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useUserContext } from '../../src/context/SupabaseAuthContext';
import { CrypXProvider, useCrypX } from '../../src/context/CrypXContext';

function CrypXShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
    const { user } = useUserContext();
  const {
    lang,
    toggleLang,
    t,
    unreadNotifications,
    isFounderOrAdmin,
    broadcastBanner,
    lockdownMode,
  } = useCrypX();

  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const isAuthPage =
    pathname?.startsWith('/sign-in') ||
    pathname?.startsWith('/sign-up') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/staff');

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (lockdownMode && !isFounderOrAdmin) {
    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400 text-2xl font-black mb-4">
          !
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {t('وضع الحماية والصيانة مفعّل حالياً', 'System Lockdown & Maintenance Active')}
        </h1>
        <p className="text-zinc-400 text-sm max-w-md leading-relaxed">
          {t(
            'تقوم إدارة Cryp X حالياً بإجراء تحديثات أمنية شاملة. سنعود للعمل خلال دقائق قليلة.',
            'Cryp X Administration is currently performing security upgrades. We will be back shortly.'
          )}
        </p>
      </div>
    );
  }

  const avatarUrl =
    user?.imageUrl ||
    'https://ui-avatars.com' +
      encodeURIComponent(user?.name || 'User');

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#000000] text-zinc-100 flex flex-col font-sans selection:bg-[#0ea5e9]/30"
    >
      {/* شريط الإعلانات العامة من غرفة العمليات */}
      {broadcastBanner && (
        <div className="bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#0284c7] text-white text-xs font-semibold py-2 px-4 text-center shadow-md z-50">
          {broadcastBanner}
        </div>
      )}

      {/* الشريط العلوي المطابق لإنستغرام بهوية Cryp X */}
      <header className="sticky top-0 z-40 h-14 bg-[#000000]/90 backdrop-blur-md border-b border-zinc-900 px-4 flex items-center justify-between">
        {/* اليمين: زر النشر السريع (+) وزر غرفة العمليات للمدير */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateMenuOpen(!createMenuOpen)}
            aria-label="Create"
            className="w-9 h-9 rounded-xl hover:bg-zinc-900 flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {isFounderOrAdmin && (
            <Link
              href="/admin"
              className="px-2.5 py-1 rounded-lg bg-[#0ea5e9]/15 border border-[#0ea5e9]/40 text-[#38bdf8] text-[11px] font-bold tracking-wide hover:bg-[#0ea5e9]/25 transition-colors"
            >
              {t('غرفة القيادة', 'MATRIX')}
            </Link>
          )}
        </div>

        {/* المنتصف: شعار Cryp X الرسمي */}
        <Link href="/" className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-lg bg-[#0ea5e9] flex items-center justify-center text-white font-black text-sm">
            X
          </div>
          <span dir="ltr" className="text-xl font-extrabold tracking-tight text-white">
            Cryp <span className="text-[#0ea5e9]">X</span>
          </span>
        </Link>

        {/* اليسار: مبدّل اللغة السريع وأيقونة الإشعارات (القلب) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            className="text-[11px] font-bold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg"
          >
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>

          <Link
            href="/notifications"
            className="relative w-9 h-9 rounded-xl hover:bg-zinc-900 flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-black" />
            )}
          </Link>
        </div>
      </header>

      {/* قائمة النشر السريع المنبثقة (منشور / قصة / ريلز) */}
      {createMenuOpen && (
        <div
          onClick={() => setCreateMenuOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-16 px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-[#121215] border border-zinc-800 rounded-2xl p-2 shadow-2xl space-y-1"
          >
            <button
              type="button"
              onClick={() => {
                setCreateMenuOpen(false);
                router.push('/create-post');
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-zinc-900 text-sm font-medium text-white"
            >
              <span>{t('منشور جديد', 'New Post')}</span>
              <span className="text-[#0ea5e9]">⊞</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateMenuOpen(false);
                router.push('/create-story');
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-zinc-900 text-sm font-medium text-white"
            >
              <span>{t('إضافة قصة (24 ساعة)', 'Add Story (24h)')}</span>
              <span className="text-emerald-400">⊕</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateMenuOpen(false);
                router.push('/create-reel');
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-zinc-900 text-sm font-medium text-white"
            >
              <span>{t('مقطع ريلز قصير', 'Create Reel')}</span>
              <span className="text-purple-400">▶</span>
            </button>
          </div>
        </div>
      )}

      {/* المحتوى الرئيسي للصفحة */}
      <main className="flex-1 w-full max-w-2xl mx-auto pb-20">{children}</main>

      {/* الشريط السفلي النظيف (5 أيقونات مطابقة لإنستغرام) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 h-14 bg-[#000000]/95 backdrop-blur-md border-t border-zinc-900 px-2 flex items-center justify-around">
        {/* 1. الرئيسية */}
        <Link
          href="/"
          className={`p-2 rounded-xl transition-colors ${
            pathname === '/' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <svg className="w-6 h-6" fill={pathname === '/' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </Link>

        {/* 2. الريلز */}
        <Link
          href="/reels"
          className={`p-2 rounded-xl transition-colors ${
            pathname?.startsWith('/reels') ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </Link>

        {/* 3. الرسائل المباشرة */}
        <Link
          href="/messages"
          className={`p-2 rounded-xl transition-colors ${
            pathname?.startsWith('/messages') ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </Link>

        {/* 4. البحث والاستكشاف */}
        <Link
          href="/explore"
          className={`p-2 rounded-xl transition-colors ${
            pathname?.startsWith('/explore') ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </Link>

        {/* 5. الملف الشخصي */}
        <Link
          href={user?.id ? `/profile/${user.id}` : '/sign-in'}
