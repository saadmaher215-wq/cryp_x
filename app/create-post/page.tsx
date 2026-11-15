'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../src/lib/supabase/client';
import { useUserContext } from '../../src/context/SupabaseAuthContext';
import { useCrypX } from '../../src/context/CrypXContext';

type PublishMode = 'post' | 'reel' | 'story';

export default function CrypXCreateStudio() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useUserContext();
  const { t, lang } = useCrypX();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<PublishMode>('post');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);

  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState('');
  const [audioTitle, setAudioTitle] = useState('');
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [hideLikes, setHideLikes] = useState(false);
  const [commentsDisabled, setCommentsDisabled] = useState(false);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);

  const [isPublishing, setIsPublishing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.item(0);
    if (!file) return;

    const videoCheck = file.type.startsWith('video/');
    setIsVideo(videoCheck);
    setSelectedFile(file);
    setErrorMsg(null);

    if (videoCheck && mode === 'post') {
      setMode('reel');
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;

    if (!selectedFile) {
      setErrorMsg(t('يرجى اختيار صورة أو فيديو أولاً.', 'Please select an image or video first.'));
      return;
    }

    setIsPublishing(true);
    setErrorMsg(null);
    setStatusText(t('جاري رفع الوسائط إلى خوادم Cryp X...', 'Uploading media to Cryp X servers...'));

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id || user?.id;

      if (!uid) {
        throw new Error(t('يرجى تسجيل الدخول أولاً.', 'Please sign in first.'));
      }

      const ext = selectedFile.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
      const folder = mode === 'story' ? 'stories' : mode === 'reel' ? 'reels' : 'posts';
      const filePath = `${folder}/${uid}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(filePath);
      const mediaUrl = publicUrlData.publicUrl;

      setStatusText(t('جاري النشر والتحديث الفوري...', 'Publishing and syncing...'));

      if (mode === 'story') {
        const { error: storyErr } = await supabase.from('stories').insert({
          user_id: uid,
          media_url: mediaUrl,
          media_type: isVideo ? 'video' : 'image',
          caption: caption.trim() || null,
          audio_title: audioTitle.trim() || null,
          close_friends_only: closeFriendsOnly,
        });

        if (storyErr) throw new Error(storyErr.message);

        router.push('/');
        router.refresh();
        return;
      }

      const tagsArray = tags
        .split(',')
        .map((tg) => tg.trim())
        .filter(Boolean);

      const { error: postErr } = await supabase.from('posts').insert({
        creator_id: uid,
        caption: caption.trim(),
        image_url: mediaUrl,
        location: location.trim() || null,
        tags: tagsArray,
        media_type: mode === 'reel' || isVideo ? 'reel' : 'image',
        is_ai_generated: isAiGenerated,
        hide_likes: hideLikes,
        comments_disabled: commentsDisabled,
        audio_title: audioTitle.trim() || null,
      });

      if (postErr) {
        throw new Error(postErr.message);
      }

      router.push(mode === 'reel' ? '/reels' : '/');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || t('حدث خطأ أثناء النشر.', 'An error occurred while publishing.'));
    } finally {
      setIsPublishing(false);
    }
  };
  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#000000] text-zinc-100 pb-24 px-4 pt-4"
    >
      {/* شريط عنوان الاستوديو */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-zinc-400 hover:text-white text-sm font-medium"
        >
          {t('إلغاء', 'Cancel')}
        </button>
        <h1 className="text-base font-bold text-white">
          {mode === 'post' && t('منشور جديد', 'New Post')}
          {mode === 'reel' && t('ريلز جديد', 'New Reel')}
          {mode === 'story' && t('إضافة إلى قصتك', 'Add to Story')}
        </h1>
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing || !selectedFile}
          className="text-sm font-bold text-[#0ea5e9] disabled:text-zinc-600"
        >
          {isPublishing ? t('جاري النشر...', 'Sharing...') : t('مشاركة', 'Share')}
        </button>
      </div>

      {/* شريط التبديل بين (منشور / ريلز / قصة 24س) */}
      <div className="grid grid-cols-3 gap-1.5 bg-[#121215] p-1 rounded-2xl border border-zinc-800/80 mb-5">
        <button
          type="button"
          onClick={() => setMode('post')}
          className={`py-2 rounded-xl text-xs font-bold transition-colors ${
            mode === 'post' ? 'bg-[#0ea5e9] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          {t('منشور', 'Post')}
        </button>
        <button
          type="button"
          onClick={() => setMode('reel')}
          className={`py-2 rounded-xl text-xs font-bold transition-colors ${
            mode === 'reel' ? 'bg-[#0ea5e9] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          {t('ريلز', 'Reel')}
        </button>
        <button
          type="button"
          onClick={() => setMode('story')}
          className={`py-2 rounded-xl text-xs font-bold transition-colors ${
            mode === 'story' ? 'bg-[#0ea5e9] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          {t('قصة (24س)', 'Story (24h)')}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handlePublish} className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFilePick}
          className="hidden"
        />

        {/* منطقة معاينة واختيار الصورة أو الفيديو */}
        {!previewUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="h-72 rounded-3xl bg-[#121215] border-2 border-dashed border-zinc-800 hover:border-[#0ea5e9] flex flex-col items-center justify-center cursor-pointer transition-colors p-6 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#0ea5e9]/15 text-[#0ea5e9] flex items-center justify-center text-2xl mb-3">
              +
            </div>
            <p className="text-sm font-bold text-white mb-1">
              {t('اختر صورة أو فيديو من جهازك', 'Select a photo or video from device')}
            </p>
            <p className="text-xs text-zinc-500">
              {t('يدعم الصور عالية الدقة ومقاطع الفيديو القصيرة', 'Supports HD photos and short videos')}
            </p>
          </div>
        ) : (
          <div className="relative rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800">
            {isVideo ? (
              <video
                src={previewUrl}
                controls
                className="w-full max-h-96 object-contain bg-black"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-96 object-contain bg-black"
              />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-zinc-700"
            >
              {t('تغيير الوسائط', 'Change Media')}
            </button>
          </div>
        )}

        {/* كتابة الشرح التوضيحي */}
        <div>
          <textarea
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t('اكتب شرحاً توضيحياً أو فكرة...', 'Write a caption...')}
            className="w-full bg-[#121215] border border-zinc-800 focus:border-[#0ea5e9] rounded-2xl p-3.5 text-sm text-white placeholder-zinc-500 outline-none resize-none"
          />
        </div>

        {/* خيارات إضافية للمنشورات والريلز */}
        {mode !== 'story' && (
          <div className="space-y-3 bg-[#121215] border border-zinc-800/80 rounded-2xl p-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {t('إضافة موقع', 'Add Location')}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('مثال: غزة، دبي، الرياض...', 'e.g. Gaza, Dubai, London...')}
                className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {t('المقطع الصوتي / الموسيقى', 'Audio / Music Track')}
              </label>
              <input
                type="text"
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                placeholder={t('اسم الصوت الأصلي أو الموسيقى...', 'Original audio or track name...')}
                className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {t('الوسوم (افصل بينها بفاصلة)', 'Tags (comma separated)')}
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="crypx, tech, design"
                className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
              />
            </div>

            {/* مفاتيح التحكم المتقدمة */}
            <div className="pt-2 border-t border-zinc-800 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-zinc-200">
                  {t('إضافة تسمية ذكاء اصطناعي (AI)', 'Add AI Content Label')}
                </span>
                <input
                  type="checkbox"
                  checked={isAiGenerated}
                  onChange={(e) => setIsAiGenerated(e.target.checked)}
                  className="w-4 h-4 accent-[#0ea5e9]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-zinc-200">
                  {t('إخفاء عدد تسجيلات الإعجاب', 'Hide Like Count')}
                </span>
                <input
                  type="checkbox"
                  checked={hideLikes}
                  onChange={(e) => setHideLikes(e.target.checked)}
                  className="w-4 h-4 accent-[#0ea5e9]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-zinc-200">
                  {t('إيقاف تشغيل التعليقات', 'Turn Off Commenting')}
                </span>
                <input
                  type="checkbox"
                  checked={commentsDisabled}
                  onChange={(e) => setCommentsDisabled(e.target.checked)}
                  className="w-4 h-4 accent-[#0ea5e9]"
                />
              </label>
            </div>
          </div>
        )}

        {/* خيارات النشر الخاصة بالقصة */}
        {mode === 'story' && (
          <div className="bg-[#121215] border border-zinc-800/80 rounded-2xl p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-bold text-emerald-400">
                  {t('الأصدقاء المقربون فقط', 'Close Friends Only')}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {t('تظهر القصة لقائمة أصدقائك المقربين لمدة 24 ساعة', 'Visible to close friends for 24h')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={closeFriendsOnly}
                onChange={(e) => setCloseFriendsOnly(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={isPublishing || !selectedFile}
          className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isPublishing ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{statusText}</span>
            </>
          ) : (
            <span>
                            {mode === 'story'
                ? t('مشاركة في قصتك الآن', 'Share to Your Story')
                : t('نشر الآن في Cryp X', 'Publish to Cryp X')}
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

