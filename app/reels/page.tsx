'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../../src/lib/supabase/client';
import { useUserContext } from '../../src/context/SupabaseAuthContext';
import { useCrypX } from '../../src/context/CrypXContext';
import VerifiedBadge from '../../src/components/shared/VerifiedBadge';

export default function CrypXReelsPage() {
  const supabase = createClient();
  const { user } = useUserContext();
  const { t, lang } = useCrypX();

  const [reels, setReels] = useState<any[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReels();
  }, [user?.id]);

  const loadReels = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('posts')
        .select('*, creator:users!posts_creator_id_fkey(id, name, username, image_url, is_verified)')
        .eq('media_type', 'reel')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(30);

      if (data) setReels(data);

      if (user?.id) {
        const { data: likesData } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id);
        if (likesData) {
          setLikedIds(new Set(likesData.map((l: any) => l.post_id)));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = async (reel: any) => {
    if (!user?.id) return;
    const isLiked = likedIds.has(reel.id);
    const updated = new Set(likedIds);

    if (isLiked) {
      updated.delete(reel.id);
      setLikedIds(updated);
      await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', reel.id);
    } else {
      updated.add(reel.id);
      setLikedIds(updated);
      await supabase.from('likes').insert({ user_id: user.id, post_id: reel.id });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-[80vh] bg-black text-white flex flex-col items-center justify-center p-6 text-center"
      >
        <p className="text-zinc-400 text-sm mb-4">
          {t('لا توجد مقاطع ريلز منشورة بعد.', 'No reels published yet.')}
        </p>
        <Link
          href="/create-post"
          className="bg-[#0ea5e9] text-white text-xs font-bold px-5 py-2.5 rounded-xl"
        >
          {t('انشر أول ريل الآن', 'Publish First Reel')}
        </Link>
      </div>
    );
  }

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="bg-black text-white space-y-4 pb-24">
      {reels.map((reel) => {
        const isLiked = likedIds.has(reel.id);
        const creatorAvatar =
          reel.creator?.image_url ||
          'https://ui-avatars.com' +
            encodeURIComponent(reel.creator?.name || 'User');

        return (
          <div
            key={reel.id}
            className="relative w-full h-[78vh] bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-900"
          >
            <video
              src={reel.image_url}
              controls
              playsInline
              loop
              className="w-full h-full object-cover"
            />

            <div className="absolute bottom-14 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between pointer-events-none">
              <div className="space-y-1.5 pointer-events-auto max-w-[75%]">
                <Link
                  href={`/profile/${reel.creator_id}`}
                  className="flex items-center gap-2"
                >
                  <img
                    src={creatorAvatar}
                    alt="Creator"
                    className="w-9 h-9 rounded-full object-cover border border-white/30"
                  />
                  <span className="text-xs font-extrabold text-white">
                    {reel.creator?.username || 'user'}
                  </span>
                  {reel.creator?.is_verified && <VerifiedBadge size={14} />}
                </Link>
                {reel.caption && (
                  <p className="text-xs text-zinc-200 line-clamp-2">{reel.caption}</p>
                )}
              </div>

              <div className="flex flex-col items-center gap-4 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => handleToggleLike(reel)}
                  className="flex flex-col items-center gap-1"
                >
                  <span className={`text-2xl ${isLiked ? 'text-red-500' : 'text-white'}`}>
                    {isLiked ? '♥' : '♡'}
                  </span>
                  <span className="text-[10px] font-bold">
                    {isLiked ? t('أعجبني', 'Liked') : t('إعجاب', 'Like')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
