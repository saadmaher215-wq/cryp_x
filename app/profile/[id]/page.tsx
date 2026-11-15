'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../src/lib/supabase/client';
import { useUserContext } from '../../../src/context/SupabaseAuthContext';
import { useCrypX } from '../../../src/context/CrypXContext';
import VerifiedBadge from '../../../src/components/shared/VerifiedBadge';

type ProfileTab = 'posts' | 'reels' | 'saved' | 'archived';

export default function CrypXProfilePage() {
  const params = useParams();
  const profileId = (params?.id as string) || '';
  const router = useRouter();
  const supabase = createClient();
  const { user } = useUserContext();
  const {
    t,
    lang,
    toggleLang,
    savedAccounts,
    isFounderOrAdmin,
  } = useCrypX();

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<any[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [loading, setLoading] = useState(true);

  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrThemeIndex, setQrThemeIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const isOwnProfile = Boolean(user?.id && user.id === profileId);

  const qrThemes = [
    'from-[#0284c7] via-[#0ea5e9] to-[#38bdf8]',
    'from-amber-500 via-orange-500 to-rose-500',
    'from-emerald-600 via-teal-500 to-cyan-500',
    'from-indigo-600 via-purple-600 to-pink-500',
  ];

  useEffect(() => {
    if (profileId) {
      loadFullProfile();
    }
  }, [profileId, user?.id]);

  const loadFullProfile = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();

      if (userData) {
        setProfile(userData);
        setNoteText(userData.daily_note || '');
      }

      const { data: userPosts } = await supabase
        .from('posts')
        .select('*')
        .eq('creator_id', profileId)
        .eq('is_archived', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (userPosts) setPosts(userPosts);

      const { count: fwers } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', profileId);
      setFollowersCount(fwers || 0);

      const { count: fwing } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', profileId);
      setFollowingCount(fwing || 0);

      if (user?.id && user.id !== profileId) {
        const { data: followRow } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', profileId)
          .maybeSingle();
        setIsFollowing(Boolean(followRow));
      }

      if (user?.id && user.id === profileId) {
        const { data: arch } = await supabase
          .from('posts')
          .select('*')
          .eq('creator_id', profileId)
          .eq('is_archived', true)
          .order('created_at', { ascending: false });
        if (arch) setArchivedPosts(arch);

        const { data: savesData } = await supabase
          .from('saves')
          .select('post:posts(*)')
          .eq('user_id', profileId);
        if (savesData) {
          setSavedPosts(savesData.map((s: any) => s.post).filter(Boolean));
        }
      }
    } catch {
      // تجاهل الأخطاء الصامتة
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!user?.id) {
      router.push('/sign-in');
      return;
    }

    if (isFollowing) {
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', profileId);
    } else {
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: profileId,
      });
      await supabase.from('notifications').insert({
        recipient_id: profileId,
        actor_id: user.id,
        type: 'follow',
        content: 'بدأ بمتابعتك',
      });
    }
  };

  const handleSaveDailyNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    const cleanNote = noteText.trim();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('users')
      .update({
        daily_note: cleanNote || null,
        note_expires_at: cleanNote ? expires : null,
      })
      .eq('id', user.id);

    setProfile((prev: any) => ({ ...prev, daily_note: cleanNote || null }));
    setNoteModalOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('socialens_auth');
      localStorage.removeItem('socialens_user');
    }
    router.push('/sign-in');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <p className="text-zinc-400 text-sm mb-4">
          {t('لم يتم العثور على هذا الملف الشخصي.', 'Profile not found.')}
        </p>
        <Link href="/" className="bg-[#0ea5e9] text-white text-xs font-bold px-5 py-2.5 rounded-xl">
          {t('العودة للرئيسية', 'Back to Home')}
        </Link>
      </div>
    );
  }

  const avatarUrl =
    profile.image_url ||
    'https://ui-avatars.com' +
      encodeURIComponent(profile.name || 'User');

  const displayList =
    activeTab === 'posts'
      ? posts
      : activeTab === 'reels'
      ? posts.filter((p) => p.media_type === 'reel')
      : activeTab === 'saved'
      ? savedPosts
      : archivedPosts;

  const profileShareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/profile/${profile.id}` : '';

  const qrApiUrl = `https://qrserver.com{encodeURIComponent(
    profileShareUrl
  )}`;

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-black text-zinc-100 pb-24">
      {/* الهيدر العلوي للملف الشخصي */}
      <div className="px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setSettingsDrawerOpen(true)}
              aria-label="Settings Menu"
              className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-white text-lg"
            >
              ☰
            </button>
          )}
          <Link
            href="/create-post"
            className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-white text-lg font-bold"
          >
            +
          </Link>
        </div>

        {/* مبدّل الحسابات المتعدد */}
        <button
          type="button"
          onClick={() => isOwnProfile && setAccountSwitcherOpen(true)}
          className="flex items-center gap-1.5 font-extrabold text-base text-white"
        >
          <span>{profile.username}</span>
                    {profile.is_verified && <VerifiedBadge size={17} />}
          {isOwnProfile && <span className="text-xs text-zinc-400">⌄</span>}
        </button>

        <button
          type="button"
          onClick={() => setQrModalOpen(true)}
          className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-xs font-bold text-[#0ea5e9]"
        >
          QR
        </button>
      </div>

      {/* قسم الهوية والإحصائيات */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between gap-4">
          {/* الصورة الدائرية + فقاعة الحالة */}
          <div className="relative shrink-0">
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setNoteModalOpen(true)}
                className="absolute -top-4 right-0 left-0 mx-auto w-max max-w-[110px] truncate bg-[#18181b] border border-zinc-700 text-zinc-200 text-[10px] px-2.5 py-1 rounded-2xl shadow-lg z-10"
              >
                {profile.daily_note || t('أجواء اليوم...', 'Note...')}
              </button>
            )}
            <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-[#0ea5e9] to-emerald-400">
              <img
                src={avatarUrl}
                alt={profile.name}
                className="w-full h-full rounded-full object-cover border-2 border-black"
              />
            </div>
            {isOwnProfile && (
              <Link
                href="/create-post"
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#0ea5e9] border-2 border-black text-white text-xs font-black flex items-center justify-center"
              >
                +
              </Link>
            )}
          </div>

          {/* العدادات الثلاثة */}
          <div className="flex-1 grid grid-cols-3 text-center">
            <div>
              <p className="text-base font-extrabold text-white">{posts.length}</p>
              <p className="text-[11px] text-zinc-400">{t('منشورات', 'Posts')}</p>
            </div>
            <div>
              <p className="text-base font-extrabold text-white">{followersCount}</p>
              <p className="text-[11px] text-zinc-400">{t('متابعون', 'Followers')}</p>
            </div>
            <div>
              <p className="text-base font-extrabold text-white">{followingCount}</p>
              <p className="text-[11px] text-zinc-400">{t('متابعة', 'Following')}</p>
            </div>
          </div>
        </div>

        {/* الاسم والشارات والسيرة الذاتية */}
        <div className="mt-3.5 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm font-bold text-white">{profile.name}</h1>
            {profile.pronouns && (
              <span className="text-[11px] text-zinc-500">{profile.pronouns}</span>
            )}
            {profile.badge_type === 'founder' && (
              <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md">
                FOUNDER 👑
              </span>
            )}
          </div>

          {profile.category && (
            <p className="text-xs text-[#38bdf8] font-medium">{profile.category}</p>
          )}

          {profile.bio && (
            <p className="text-xs text-zinc-200 whitespace-pre-line leading-relaxed">
              {profile.bio}
            </p>
          )}

          {profile.external_link && (
            <a
              href={
                profile.external_link.startsWith('http')
                  ? profile.external_link
                  : `https://${profile.external_link}`
              }
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="inline-block text-xs text-[#0ea5e9] font-medium hover:underline pt-0.5"
            >
              🔗 {profile.external_link}
            </a>
          )}
        </div>

        {/* بطاقة لوحة المعلومات الاحترافية لصاحب الحساب */}
        {isOwnProfile && (
          <div className="mt-4 p-3 rounded-2xl bg-[#121215] border border-zinc-800/90 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">
                {t('لوحة المعلومات الاحترافية', 'Professional Dashboard')}
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {t('إحصائيات حسابك والتفاعل في آخر 30 يوماً', 'Account insights for last 30 days')}
              </p>
            </div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0ea5e9]">
              <span>{posts.reduce((acc, item) => acc + (item.views_count || 0), 0)}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </span>

          </div>
        )}

        {/* أزرار الإجراءات السريعة */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {isOwnProfile ? (
            <>
              <Link
                href={`/update-profile/${profile.id}`}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl text-center transition-colors"
              >
                {t('تعديل الملف الشخصي', 'Edit Profile')}
              </Link>
              <button
                type="button"
                onClick={() => setQrModalOpen(true)}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl text-center transition-colors"
              >
                {t('مشاركة الملف الشخصي', 'Share Profile')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleToggleFollow}
                className={`text-xs font-bold py-2.5 rounded-xl transition-colors ${
                  isFollowing
                    ? 'bg-zinc-900 border border-zinc-800 text-white'
                    : 'bg-[#0ea5e9] text-white'
                }`}
              >
                {isFollowing ? t('أتابع ✓', 'Following ✓') : t('متابعة', 'Follow')}
              </button>
              <Link
                href={`/messages?to=${profile.id}`}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl text-center transition-colors"
              >
                {t('مراسلة', 'Message')}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* تبويبات المحتوى (الشبكة / الريلز / المحفوظات / الأرشيف) */}
      <div className="grid grid-cols-4 border-t border-b border-zinc-900">
        <button
          type="button"
          onClick={() => setActiveTab('posts')}
          className={`py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'posts'
              ? 'border-white text-white'
              : 'border-transparent text-zinc-500'
          }`}
        >
          ⊞ {t('المنشورات', 'Posts')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reels')}
          className={`py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'reels'
              ? 'border-white text-white'
              : 'border-transparent text-zinc-500'
          }`}
        >
          ▶ {t('ريلز', 'Reels')}
        </button>
        {isOwnProfile && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`py-3 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'saved'
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-500'
              }`}
            >
              🔖 {t('محفوظة', 'Saved')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`py-3 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'archived'
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-500'
              }`}
            >
              📦 {t('أرشيف', 'Archive')}
            </button>
          </>
        )}
      </div>

      {/* شبكة الصور والريلز الثلاثية */}
      {displayList.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-xs">
          {t('لا يوجد محتوى في هذا القسم بعد.', 'No content in this section yet.')}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 bg-black">
          {displayList.map((item) => (
            <Link
              key={item.id}
              href={`/posts/${item.id}`}
              className="relative aspect-square bg-zinc-950 overflow-hidden group"
            >
              {item.media_type === 'reel' ? (
                <video src={item.image_url} className="w-full h-full object-cover" />
              ) : (
                <img src={item.image_url} alt="Grid item" className="w-full h-full object-cover" />
              )}
              {item.is_pinned && (
                <span className="absolute top-1.5 right-1.5 text-xs bg-black/60 px-1.5 py-0.5 rounded">
                  📌
                </span>
              )}
              {item.media_type === 'reel' && (
                <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                  ▶ {item.views_count || 0}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* نافذة الملاحظة اليومية (Daily Note) */}
      {noteModalOpen && (
        <div
          onClick={() => setNoteModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveDailyNote}
            className="w-full max-w-xs bg-[#121215] border border-zinc-800 rounded-3xl p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-white text-center">
              {t('ملاحظة جديدة (تظهر 24 ساعة)', 'New Note (Visible for 24h)')}
            </h3>
            <input
              type="text"
              maxLength={60}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t('شارك فكرة سريعة...', 'Share a quick thought...')}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3 text-xs text-white outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-[#0ea5e9] text-white text-xs font-bold py-2.5 rounded-xl"
              >
                {t('مشاركة', 'Share')}
              </button>
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                className="px-4 bg-zinc-900 text-zinc-400 text-xs font-bold rounded-xl"
              >
                {t('إلغاء', 'Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* بطاقة QR Code التفاعلية لمشاركة الملف الشخصي */}
      {qrModalOpen && (
        <div
          onClick={() => setQrModalOpen(false)}
          className={`fixed inset-0 z-50 bg-gradient-to-br ${qrThemes.at(qrThemeIndex)} flex flex-col justify-between p-5`}
        >
          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="w-9 h-9 rounded-full bg-black/30 text-white font-bold flex items-center justify-center"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => setQrThemeIndex((prev) => (prev + 1) % qrThemes.length)}
              className="bg-black/30 backdrop-blur-md text-white text-xs font-bold px-4 py-1.5 rounded-full border border-white/25"
            >
              {t('تغيير اللون', 'Color')}
            </button>
            <div className="w-9" />
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center max-w-xs w-full"
          >
            <img src={qrApiUrl} alt="Cryp X QR" className="w-52 h-52 object-contain" />
            <p dir="ltr" className="mt-3 text-lg font-black tracking-wider text-[#0284c7] uppercase">
              @{profile.username}
            </p>
            <p className="text-[10px] text-zinc-400 font-bold mt-0.5">CRYP X OFFICIAL PASS</p>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-xs w-full mx-auto bg-white/95 backdrop-blur-md rounded-2xl p-3 grid grid-cols-2 gap-2 text-zinc-900"
          >
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(profileShareUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }
              }}
              className="py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold"
            >
              {copiedLink ? t('✓ تم النسخ', '✓ Copied') : t('نسخ الرابط', 'Copy Link')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.share) {
                  navigator.share({ title: profile.name, url: profileShareUrl });
                }
              }}
              className="py-2.5 rounded-xl bg-[#0ea5e9] text-white text-xs font-bold"
            >
              {t('مشاركة', 'Share')}
            </button>
          </div>
        </div>
      )}

            {/* نافذة مبدّل الحسابات المتعدد */}
      {accountSwitcherOpen && (
        <div
          onClick={() => setAccountSwitcherOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#121215] border border-zinc-800 rounded-3xl p-4 space-y-3"
          >
            <h3 className="text-sm font-bold text-white text-center pb-2 border-b border-zinc-800">
              {t('حسابات Cryp X', 'Cryp X Accounts')}
            </h3>
            {savedAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-900/70"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={acc.avatar}
                    alt={acc.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-xs font-bold text-white">{acc.username}</p>
                    <p className="text-[11px] text-zinc-400">{acc.email}</p>
                  </div>
                </div>
                {acc.id === profile.id ? (
                  <span className="w-5 h-5 rounded-full bg-[#0ea5e9] text-white text-xs flex items-center justify-center">
                    ✓
                  </span>
                ) : (
                  <Link
                    href="/sign-in"
                    className="text-xs text-[#0ea5e9] font-bold px-3 py-1.5 rounded-xl bg-[#0ea5e9]/10"
                  >
                    {t('تبديل', 'Switch')}
                  </Link>
                )}
              </div>
            ))}
            <Link
              href="/sign-in"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-dashed border-zinc-700 text-xs font-bold text-[#0ea5e9] hover:bg-zinc-900"
            >
              <span>+ {t('إضافة حساب Cryp X', 'Add Cryp X Account')}</span>
            </Link>
          </div>
        </div>
      )}

      {/* مركز الإعدادات والنشاط الشامل (زر الـ 3 شرطات ☰) */}
      {settingsDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black overflow-y-auto pb-16">
          <div className="sticky top-0 bg-black/95 backdrop-blur-md border-b border-zinc-900 px-4 py-3.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSettingsDrawerOpen(false)}
              className="text-white text-lg font-bold"
            >
              ✕
            </button>
            <h2 className="text-base font-bold text-white">
              {t('الإعدادات والنشاط', 'Settings and Activity')}
            </h2>
            <div className="w-6" />
          </div>

          <div className="p-4 max-w-lg mx-auto space-y-5">
            <input
              type="text"
              value={settingsSearch}
              onChange={(e) => setSettingsSearch(e.target.value)}
              placeholder={t('بحث في الإعدادات...', 'Search settings...')}
              className="w-full bg-[#121215] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
            />

            {isFounderOrAdmin && (
              <Link
                href="/admin"
                onClick={() => setSettingsDrawerOpen(false)}
                className="block p-4 rounded-2xl bg-gradient-to-r from-[#0284c7]/20 to-[#0ea5e9]/10 border border-[#0ea5e9]/40"
              >
                <p className="text-xs font-extrabold text-[#38bdf8]">
                  👑 {t('غرفة قيادة الإدارة العليا (Matrix Control)', 'Executive Matrix Command Center')}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  {t(
                    'إدارة الحسابات، التوثيق، الحظر، تعيين المشرفين، ودرع الطوارئ',
                    'Manage accounts, verification, bans, staff links, and lockdown'
                  )}
                </p>
              </Link>
            )}

            <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl divide-y divide-zinc-800/80">
              <button
                type="button"
                onClick={toggleLang}
                className="w-full flex items-center justify-between p-4 text-xs font-bold text-white"
              >
                <span>🌐 {t('لغة التطبيق (العربية / English)', 'App Language (AR / EN)')}</span>
                <span className="text-[#0ea5e9]">{lang === 'ar' ? 'العربية' : 'English'}</span>
              </button>

              <Link
                href={`/update-profile/${profile.id}`}
                onClick={() => setSettingsDrawerOpen(false)}
                className="flex items-center justify-between p-4 text-xs font-bold text-white"
              >
                <span>👤 {t('مركز حسابات Cryp X وتعديل البيانات', 'Cryp X Account Center')}</span>
                <span className="text-zinc-500">›</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setSettingsDrawerOpen(false);
                  setActiveTab('saved');
                }}
                className="w-full flex items-center justify-between p-4 text-xs font-bold text-white"
              >
                <span>🔖 {t('العناصر المحفوظة', 'Saved Items')}</span>
                <span className="text-zinc-500">›</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettingsDrawerOpen(false);
                  setActiveTab('archived');
                }}
                className="w-full flex items-center justify-between p-4 text-xs font-bold text-white"
              >
                <span>📦 {t('الأرشيف والقصص المؤرشفة', 'Archive')}</span>
                <span className="text-zinc-500">›</span>
              </button>

              <Link
                href="/notifications"
                onClick={() => setSettingsDrawerOpen(false)}
                className="flex items-center justify-between p-4 text-xs font-bold text-white"
              >
                <span>🔔 {t('الإشعارات والتفاعلات', 'Notifications')}</span>
                <span className="text-zinc-500">›</span>
              </Link>

              <Link
                href="/sign-in"
                className="block p-4 text-xs font-bold text-[#0ea5e9]"
              >
                + {t('إضافة حساب أو تبديل الملف الشخصي', 'Add Account or Switch Profile')}
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full text-right p-4 text-xs font-bold text-red-400"
              >
                {t('تسجيل الخروج من الحساب', 'Log Out')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
