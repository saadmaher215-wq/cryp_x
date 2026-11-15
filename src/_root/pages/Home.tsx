'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { useUserContext } from '../../context/SupabaseAuthContext';
import { useCrypX } from '../../context/CrypXContext';

interface StoryItem {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  user?: {
    id: string;
    name: string;
    username: string;
    image_url: string | null;
    is_verified?: boolean;
    badge_type?: string | null;
  };
}

interface PostItem {
  id: string;
  creator_id: string;
  caption: string;
  image_url: string;
  location: string | null;
  media_type: string;
  is_pinned: boolean;
  hide_likes: boolean;
  comments_disabled: boolean;
  is_ai_generated: boolean;
  views_count: number;
  created_at: string;
  creator?: {
    id: string;
    name: string;
    username: string;
    image_url: string | null;
    is_verified?: boolean;
    badge_type?: string | null;
  };
  likes_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;
}

export default function CrypXHomeFeed() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useUserContext();
  const { t, lang } = useCrypX();

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [storyLiked, setStoryLiked] = useState(false);
  const [storyReplyText, setStoryReplyText] = useState('');
  const [storyReplySent, setStoryReplySent] = useState(false);

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const [menuPost, setMenuPost] = useState<PostItem | null>(null);
  const [commentPost, setCommentPost] = useState<PostItem | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');

  useEffect(() => {
    loadFeedAndStories();
  }, [user?.id]);

  const loadFeedAndStories = async () => {
    setLoadingFeed(true);
    try {
      const nowIso = new Date().toISOString();
      const { data: storiesData } = await supabase
        .from('stories')
        .select('*, user:users(id, name, username, image_url, is_verified, badge_type)')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false });

      if (storiesData) {
        setStories(storiesData as any);
      }

      const { data: postsData } = await supabase
        .from('posts')
        .select('*, creator:users(id, name, username, image_url, is_verified, badge_type)')
        .eq('is_archived', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);

      if (postsData) {
        const uid = user?.id;
        const enriched = await Promise.all(
          postsData.map(async (p: any) => {
            const { count: likesCount } = await supabase
              .from('likes')
              .select('id', { count: 'exact', head: true })
              .eq('post_id', p.id);

            let isLiked = false;
            let isSaved = false;

            if (uid) {
              const { data: likeRow } = await supabase
                .from('likes')
                .select('id')
                .eq('post_id', p.id)
                .eq('user_id', uid)
                .maybeSingle();
              isLiked = Boolean(likeRow);

              const { data: saveRow } = await supabase
                .from('saves')
                .select('id')
                .eq('post_id', p.id)
                .eq('user_id', uid)
                .maybeSingle();
              isSaved = Boolean(saveRow);
            }

            return {
              ...p,
              likes_count: likesCount || 0,
              is_liked: isLiked,
              is_saved: isSaved,
            };
          })
        );
        setPosts(enriched);
      }
    } catch {
      // تجاهل الأخطاء الصامتة
    } finally {
      setLoadingFeed(false);
    }
  };
  const handleToggleLike = async (post: PostItem) => {
    if (!user?.id) {
      router.push('/sign-in');
      return;
    }

    const currentlyLiked = Boolean(post.is_liked);
    setPosts((prev) =>
      prev.map((item) =>
        item.id === post.id
          ? {
              ...item,
              is_liked: !currentlyLiked,
              likes_count: Math.max(0, (item.likes_count || 0) + (currentlyLiked ? -1 : 1)),
            }
          : item
      )
    );

    if (currentlyLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
      if (post.creator_id !== user.id) {
        await supabase.from('notifications').insert({
          recipient_id: post.creator_id,
          actor_id: user.id,
          type: 'like',
          post_id: post.id,
          content: 'أعجب بمنشورك',
        });
      }
    }
  };

  const handleToggleSave = async (post: PostItem) => {
    if (!user?.id) return;
    const currentlySaved = Boolean(post.is_saved);

    setPosts((prev) =>
      prev.map((item) => (item.id === post.id ? { ...item, is_saved: !currentlySaved } : item))
    );

    if (currentlySaved) {
      await supabase.from('saves').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      await supabase.from('saves').insert({ post_id: post.id, user_id: user.id });
    }
  };

  const openCommentsModal = async (post: PostItem) => {
    setCommentPost(post);
    setCommentsList([]);
    const { data } = await supabase
      .from('comments')
      .select('*, author:users(id, name, username, image_url, is_verified)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });

    if (data) setCommentsList(data);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !commentPost || !newCommentText.trim()) return;

    const text = newCommentText.trim();
    setNewCommentText('');

    const { data: inserted } = await supabase
      .from('comments')
      .insert({
        post_id: commentPost.id,
        user_id: user.id,
        content: text,
      })
      .select('*, author:users(id, name, username, image_url, is_verified)')
      .single();

    if (inserted) {
      setCommentsList((prev) => [...prev, inserted]);
      if (commentPost.creator_id !== user.id) {
        await supabase.from('notifications').insert({
          recipient_id: commentPost.creator_id,
          actor_id: user.id,
          type: 'comment',
          post_id: commentPost.id,
          content: text,
        });
      }
    }
  };

  const handlePostSettingAction = async (
    action: 'pin' | 'archive' | 'hide_likes' | 'disable_comments' | 'delete'
  ) => {
    if (!menuPost) return;
    const target = menuPost;
    setMenuPost(null);

    if (action === 'delete') {
      setPosts((prev) => prev.filter((p) => p.id !== target.id));
      await supabase.from('posts').delete().eq('id', target.id);
      return;
    }

    if (action === 'archive') {
      setPosts((prev) => prev.filter((p) => p.id !== target.id));
      await supabase.from('posts').update({ is_archived: true }).eq('id', target.id);
      return;
    }

    if (action === 'pin') {
      const nextVal = !target.is_pinned;
      setPosts((prev) => prev.map((p) => (p.id === target.id ? { ...p, is_pinned: nextVal } : p)));
      await supabase.from('posts').update({ is_pinned: nextVal }).eq('id', target.id);
    }

    if (action === 'hide_likes') {
      const nextVal = !target.hide_likes;
      setPosts((prev) => prev.map((p) => (p.id === target.id ? { ...p, hide_likes: nextVal } : p)));
      await supabase.from('posts').update({ hide_likes: nextVal }).eq('id', target.id);
    }

    if (action === 'disable_comments') {
      const nextVal = !target.comments_disabled;
      setPosts((prev) =>
        prev.map((p) => (p.id === target.id ? { ...p, comments_disabled: nextVal } : p))
      );
      await supabase.from('posts').update({ comments_disabled: nextVal }).eq('id', target.id);
    }
  };

  const handleLikeStory = async (story: StoryItem) => {
    if (!user?.id) return;
    setStoryLiked(true);
    await supabase.from('story_views').upsert(
      { story_id: story.id, viewer_id: user.id, liked: true },
      { onConflict: 'story_id,viewer_id' }
    );
    if (story.user_id !== user.id) {
      await supabase.from('notifications').insert({
        recipient_id: story.user_id,
        actor_id: user.id,
        type: 'story_like',
        story_id: story.id,
        content: 'أعجب بقصتك',
      });
    }
  };

  const handleReplyStory = async (e: React.FormEvent, story: StoryItem) => {
    e.preventDefault();
    if (!user?.id || !storyReplyText.trim()) return;
    const msg = storyReplyText.trim();
    setStoryReplyText('');
    setStoryReplySent(true);

    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: story.user_id,
      content: `${t('رد على قصتك:', 'Replied to your story:')} ${msg}`,
    });

    setTimeout(() => setStoryReplySent(false), 2000);
  };
  const myAvatar =
    user?.imageUrl ||
    'https://ui-avatars.com' +
      encodeURIComponent(user?.name || 'User');

  const activeStory = activeStoryIndex !== null ? stories.at(activeStoryIndex) : null;

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="w-full pb-16">
      {/* شريط القصص التفاعلي (24 ساعة) */}
      <section className="border-b border-zinc-900 py-3.5 px-3 overflow-x-auto flex items-center gap-3.5 no-scrollbar">
        <Link href="/create-post" className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative w-16 h-16 rounded-full p-0.5 border border-zinc-800">
            <img src={myAvatar} alt="Your Story" className="w-full h-full rounded-full object-cover" />
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#0ea5e9] border-2 border-black text-white text-xs font-black flex items-center justify-center">
              +
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 font-medium">
            {t('قصتك', 'Your story')}
          </span>
        </Link>

        {stories.map((st, idx) => {
          const stAvatar =
            st.user?.image_url ||
            'https://ui-avatars.com' +
              encodeURIComponent(st.user?.name || 'User');
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                setStoryLiked(false);
                setActiveStoryIndex(idx);
              }}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-[#0ea5e9] via-sky-400 to-emerald-400">
                <img
                  src={stAvatar}
                  alt={st.user?.username || 'Story'}
                  className="w-full h-full rounded-full object-cover border-2 border-black"
                />
              </div>
              <span className="text-[11px] text-zinc-200 max-w-[68px] truncate">
                {st.user?.username || 'user'}
              </span>
            </button>
          );
        })}
      </section>

      {/* تغذية المنشورات الرئيسية */}
      {loadingFeed ? (
        <div className="py-16 flex justify-center">
          <div className="w-7 h-7 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 px-6 text-center space-y-3">
          <p className="text-zinc-300 font-bold text-base">
            {t('مرحباً بك في Cryp X!', 'Welcome to Cryp X!')}
          </p>
          <p className="text-zinc-500 text-xs max-w-xs mx-auto">
            {t(
              'لا توجد منشورات بعد. اضغط على زر + في الأعلى لمشاركة أول صورة أو مقطع ريلز.',
              'No posts yet. Tap + at the top to share your first photo or reel.'
            )}
          </p>
          <Link
            href="/create-post"
            className="inline-block mt-2 bg-[#0ea5e9] text-white text-xs font-bold px-5 py-2.5 rounded-xl"
          >
            {t('نشر أول محتوى', 'Create First Post')}
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-zinc-900">
          {posts.map((post) => {
            const creatorAvatar =
              post.creator?.image_url ||
              'https://ui-avatars.com' +
                encodeURIComponent(post.creator?.name || 'User');

            return (
              <article key={post.id} className="py-3">
                <div className="px-3.5 pb-2.5 flex items-center justify-between">
                  <Link
                    href={`/profile/${post.creator_id}`}
                    className="flex items-center gap-2.5"
                  >
                    <img
                      src={creatorAvatar}
                      alt={post.creator?.username || 'User'}
                      className="w-9 h-9 rounded-full object-cover border border-zinc-800"
                    />
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white">
                          {post.creator?.username || 'user'}
                        </span>
                        {post.creator?.is_verified && (
                          <span className="text-[#0ea5e9] text-xs font-black">✓</span>
                        )}
                        {post.creator?.badge_type === 'founder' && (
                          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded">
                            FOUNDER
                          </span>
                        )}
                        {post.is_pinned && (
                          <span className="text-[10px] text-zinc-400">📌</span>
                        )}
                      </div>
                      {post.location && (
                        <p className="text-[10px] text-zinc-400">{post.location}</p>
                      )}
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setMenuPost(post)}
                    className="text-zinc-400 hover:text-white px-2 py-1 text-lg font-bold"
                  >
                    ⋯
                  </button>
                </div>

                <div className="relative bg-zinc-950 w-full">
                  {post.media_type === 'reel' ? (
                    <video
                      src={post.image_url}
                      controls
                      playsInline
                      className="w-full max-h-[520px] object-contain bg-black"
                    />
                  ) : (
                    <img
                      src={post.image_url}
                      alt="Post"
                      onDoubleClick={() => !post.is_liked && handleToggleLike(post)}
                      className="w-full max-h-[520px] object-cover"
                    />
                  )}
                  {post.is_ai_generated && (
                    <span className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-md text-zinc-200 text-[10px] px-2.5 py-1 rounded-lg border border-zinc-700">
                      AI Info
                    </span>
                  )}
                </div>

                <div className="px-3.5 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post)}
                      className={`text-2xl transition-transform active:scale-125 ${
                        post.is_liked ? 'text-red-500' : 'text-white hover:text-zinc-400'
                      }`}
                    >
                      {post.is_liked ? '♥' : '♡'}
                    </button>

                    {!post.comments_disabled && (
                      <button
                        type="button"
                        onClick={() => openCommentsModal(post)}
                        className="text-white hover:text-zinc-400"
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
                        }
                      }}
                      className="text-white hover:text-zinc-400"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleSave(post)}
                    className={`text-xl ${post.is_saved ? 'text-[#0ea5e9]' : 'text-white'}`}
                  >
                    {post.is_saved ? '🔖' : '📑'}
                  </button>
                </div>

                <div className="px-3.5 pt-2 space-y-1">
                  {(!post.hide_likes || post.creator_id === user?.id) && (
                    <p className="text-xs font-bold text-white">
                      {post.likes_count || 0} {t('تسجيل إعجاب', 'likes')}
                    </p>
                  )}

                  {post.caption && (
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      <span className="font-bold text-white ml-1.5">
                        {post.creator?.username}
                      </span>
                      {post.caption}
                    </p>
                  )}

                  {!post.comments_disabled && (
                    <button
                      type="button"
                      onClick={() => openCommentsModal(post)}
                      className="text-[11px] text-zinc-500 pt-0.5 block"
                    >
                      {t('عرض التعليقات أو إضافة تعليق...', 'View or add comments...')}

                                        )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* عارض القصص الكامل (Story Viewer 24h) */}
      {activeStory && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between">
          <div className="p-3 pt-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10">
            <div className="flex items-center gap-2.5">
              <img
                src={
                  activeStory.user?.image_url ||
                  'https://ui-avatars.com'
                }
                alt="Story User"
                className="w-9 h-9 rounded-full object-cover border border-white/30"
              />
              <span className="text-xs font-bold text-white">{activeStory.user?.username}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveStoryIndex(null)}
              className="text-white text-xl font-bold px-2"
            >
              ✕
            </button>
          </div>

          <div
            onClick={() => {
              if (activeStoryIndex !== null && activeStoryIndex + 1 < stories.length) {
                setStoryLiked(false);
                setActiveStoryIndex(activeStoryIndex + 1);
              } else {
                setActiveStoryIndex(null);
              }
            }}
            className="flex-1 flex items-center justify-center relative cursor-pointer"
          >
            {activeStory.media_type === 'video' ? (
              <video
                src={activeStory.media_url}
                autoPlay
                playsInline
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <img
                src={activeStory.media_url}
                alt="Story"
                className="max-h-full max-w-full object-contain"
              />
            )}
            {activeStory.caption && (
              <div className="absolute bottom-6 inset-x-4 bg-black/60 backdrop-blur-md text-white text-xs p-3 rounded-xl text-center">
                {activeStory.caption}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => handleReplyStory(e, activeStory)}
            className="p-3 bg-black/90 border-t border-zinc-900 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={storyReplyText}
              onChange={(e) => setStoryReplyText(e.target.value)}
              placeholder={
                storyReplySent
                  ? t('تم إرسال ردك!', 'Reply sent!')
                  : t('إرسال رسالة...', 'Send message...')
              }
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2.5 text-xs text-white outline-none"
            />
            <button
              type="button"
              onClick={() => handleLikeStory(activeStory)}
              className={`text-2xl ${storyLiked ? 'text-red-500' : 'text-white'}`}
            >
              {storyLiked ? '♥' : '♡'}
            </button>
          </form>
        </div>
      )}
      {/* قائمة إعدادات وخيارات المنشور (⋯) */}
      {menuPost && (
        <div
          onClick={() => setMenuPost(null)}
          className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#121215] border border-zinc-800 rounded-3xl p-3 space-y-1.5"
          >
            {menuPost.creator_id === user?.id ? (
              <>
                <button
                  type="button"
                  onClick={() => handlePostSettingAction('pin')}
                  className="w-full text-right px-4 py-3 rounded-xl hover:bg-zinc-900 text-xs font-bold text-white"
                >
                  {menuPost.is_pinned
                    ? t('إلغاء التثبيت على ملفك الشخصي', 'Unpin from profile')
                    : t('تثبيت على الشبكة الأساسية الخاصة بك', 'Pin to your main grid')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePostSettingAction('hide_likes')}
                  className="w-full text-right px-4 py-3 rounded-xl hover:bg-zinc-900 text-xs font-bold text-white"
                >
                  {menuPost.hide_likes
                    ? t('إظهار عدد تسجيلات الإعجاب', 'Unhide like count')
                    : t('إخفاء عدد تسجيلات الإعجاب عن الآخرين', 'Hide like count from others')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePostSettingAction('disable_comments')}
                  className="w-full text-right px-4 py-3 rounded-xl hover:bg-zinc-900 text-xs font-bold text-white"
                >
                  {menuPost.comments_disabled
                    ? t('تشغيل التعليقات', 'Turn on commenting')
                    : t('إيقاف تشغيل التعليقات', 'Turn off commenting')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePostSettingAction('archive')}
                  className="w-full text-right px-4 py-3 rounded-xl hover:bg-zinc-900 text-xs font-bold text-white"
                >
                  {t('أرشفة المنشور', 'Archive post')}
                </button>
                <button
                  type="button"
                  onClick={() => handlePostSettingAction('delete')}
                  className="w-full text-right px-4 py-3 rounded-xl hover:bg-red-500/10 text-xs font-bold text-red-400"
                >
                  {t('حذف الوسائط نهائياً', 'Delete media permanently')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setMenuPost(null)}
                className="w-full text-right px-4 py-3 rounded-xl hover:bg-red-500/10 text-xs font-bold text-red-400"
              >
                {t('إبلاغ عن محتوى مخالف', 'Report inappropriate content')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* نافذة التعليقات التفاعلية */}
      {commentPost && (
        <div
          onClick={() => setCommentPost(null)}
          className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#121215] border-t border-zinc-800 rounded-t-3xl p-4 max-h-[75vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white">{t('التعليقات', 'Comments')}</h3>
              <button
                type="button"
                onClick={() => setCommentPost(null)}
                className="text-zinc-400 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {commentsList.length === 0 ? (
                <p className="text-center text-zinc-500 text-xs py-8">
                  {t('لا توجد تعليقات بعد. كن أول من يعلّق!', 'No comments yet. Be the first!')}
                </p>
              ) : (
                commentsList.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <img
                      src={
                        c.author?.image_url ||
                        'https://ui-avatars.com'
                      }
                      alt="Avatar"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <div className="bg-zinc-900 rounded-2xl px-3 py-2 flex-1">
                      <p className="text-[11px] font-bold text-white">
                        {c.author?.username || 'user'}
                      </p>
                      <p className="text-xs text-zinc-200 mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="pt-2 border-t border-zinc-800 flex gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={t('أضف تعليقاً...', 'Add a comment...')}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
              />
              <button
                type="submit"
                className="bg-[#0ea5e9] text-white text-xs font-bold px-4 rounded-xl"
              >
                {t('نشر', 'Post')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
