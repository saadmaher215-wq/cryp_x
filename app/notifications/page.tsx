'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../../src/lib/supabase/client';
import { useUserContext } from '../../src/context/SupabaseAuthContext';
import { useCrypX } from '../../src/context/CrypXContext';

type NotifFilter = 'all' | 'following' | 'comments' | 'follows' | 'mentions' | 'verified';

export default function CrypXNotificationsPage() {
  const supabase = createClient();
  const { user } = useUserContext();
  const { t, lang, refreshNotifications } = useCrypX();

  const [filter, setFilter] = useState<NotifFilter>('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
    }
  }, [user?.id]);

  const loadNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followRows) {
        setFollowingIds(new Set(followRows.map((r: any) => r.following_id)));
      }

      const { data: notifRows } = await supabase
        .from('notifications')
        .select('*, actor:users!notifications_actor_id_fkey(id, name, username, image_url, is_verified, badge_type)')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (notifRows) {
        setNotifications(notifRows);
      }

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      await refreshNotifications();
    } catch {
      // تجاهل الأخطاء الصامتة
    } finally {
      setLoading(false);
    }
  };

  const handleFollowBack = async (actorId: string) => {
    if (!user?.id) return;
    const isAlready = followingIds.has(actorId);
    const updated = new Set(followingIds);

    if (isAlready) {
      updated.delete(actorId);
      setFollowingIds(updated);
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', actorId);
    } else {
      updated.add(actorId);
      setFollowingIds(updated);
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: actorId,
      });
      await supabase.from('notifications').insert({
        recipient_id: actorId,
        actor_id: user.id,
        type: 'follow',
        content: 'ردّ متابعتك',
      });
    }
  };

  const filteredList = notifications.filter((n) => {
    if (filter === 'following') return followingIds.has(n.actor_id);
    if (filter === 'comments') return n.type === 'comment';
    if (filter === 'follows') return n.type === 'follow';
    if (filter === 'mentions') return n.type === 'mention';
    if (filter === 'verified') return Boolean(n.actor?.is_verified);
    return true;
  });
  const filterTabs: { id: NotifFilter; ar: string; en: string }[] = [
    { id: 'all', ar: 'الكل', en: 'All' },
    { id: 'following', ar: 'المتابَعون', en: 'Following' },
    { id: 'comments', ar: 'التعليقات', en: 'Comments' },
    { id: 'follows', ar: 'المتابعات', en: 'Follows' },
    { id: 'mentions', ar: 'الإشارات', en: 'Mentions' },
    { id: 'verified', ar: 'تم التحقق', en: 'Verified' },
  ];

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-black text-zinc-100 pb-24">
      <div className="sticky top-14 z-30 bg-black/95 backdrop-blur-md border-b border-zinc-900 px-4 py-3">
        <h1 className="text-lg font-extrabold text-white mb-3">
          {t('الإشعارات', 'Notifications')}
        </h1>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                filter === tab.id
                  ? 'bg-[#0ea5e9] text-white'
                  : 'bg-[#121215] border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {t(tab.ar, tab.en)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-7 h-7 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-20 text-center text-zinc-500 text-xs px-6">
          {t('لا توجد إشعارات في هذا التصنيف حالياً.', 'No notifications in this category yet.')}
        </div>
      ) : (
        <div className="divide-y divide-zinc-900/80">
          {filteredList.map((item) => {
            const actorAvatar =
              item.actor?.image_url ||
              'https://ui-avatars.com' +
                encodeURIComponent(item.actor?.name || 'User');
            const isFollowingActor = followingIds.has(item.actor_id);

            return (
              <div
                key={item.id}
                className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-950/60"
              >
                <Link
                  href={`/profile/${item.actor_id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <img
                    src={actorAvatar}
                    alt="Actor"
                    className="w-11 h-11 rounded-full object-cover border border-zinc-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      <span className="font-bold text-white ml-1">
                        {item.actor?.username || 'user'}
                      </span>
                      {item.actor?.is_verified && (
                        <span className="text-[#0ea5e9] font-black ml-1">✓</span>
                      )}
                      <span>{item.content || t('تفاعل مع حسابك', 'interacted with you')}</span>
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {new Date(item.created_at).toLocaleDateString(
                        lang === 'ar' ? 'ar-EG' : 'en-US'
                      )}
                    </p>
                  </div>
                </Link>

                {item.type === 'follow' ? (
                  isFollowingActor ? (
                    <Link
                      href={`/messages?to=${item.actor_id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-bold shrink-0"
                    >
                      {t('مراسلة', 'Message')}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleFollowBack(item.actor_id)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0ea5e9] text-white text-xs font-bold shrink-0"
                    >
                      {t('رد المتابعة', 'Follow Back')}
                    </button>
                  )
                ) : item.post_id ? (
                  <Link
                    href={`/posts/${item.post_id}`}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 text-[#0ea5e9] text-[11px] font-bold shrink-0"
                  >
                    {t('عرض', 'View')}
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
