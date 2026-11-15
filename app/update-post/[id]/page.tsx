'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../src/lib/supabase/client';
import { useCrypX } from '../../../src/context/CrypXContext';

export default function CrypXEditPostPage() {
  const params = useParams();
  const postId = (params?.id as string) || '';
  const router = useRouter();
  const supabase = createClient();
  const { t, lang } = useCrypX();

  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!postId) return;
    supabase
      .from('posts')
      .select('caption, location, image_url')
      .eq('id', postId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCaption(data.caption || '');
          setLocation(data.location || '');
          setImageUrl(data.image_url || '');
        }
      });
  }, [postId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from('posts')
      .update({ caption: caption.trim(), location: location.trim() || null })
      .eq('id', postId);
    setSaving(false);
    router.back();
  };

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-black text-white p-4 pb-24">
      <div className="flex items-center justify-between mb-5">
        <button type="button" onClick={() => router.back()} className="text-zinc-400 text-sm">
          {t('إلغاء', 'Cancel')}
        </button>
        <h1 className="text-base font-bold">{t('تعديل المنشور', 'Edit Post')}</h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-bold text-[#0ea5e9]"
        >
          {saving ? '...' : t('حفظ ✓', 'Save ✓')}
        </button>
      </div>

      {imageUrl && (
        <img src={imageUrl} alt="Post" className="w-full max-h-72 object-contain rounded-2xl mb-4 bg-zinc-950" />
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <textarea
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t('تعديل الشرح التوضيحي...', 'Edit caption...')}
          className="w-full bg-[#121215] border border-zinc-800 rounded-2xl p-3.5 text-sm text-white outline-none"
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t('الموقع...', 'Location...')}
          className="w-full bg-[#121215] border border-zinc-800 rounded-2xl p-3.5 text-sm text-white outline-none"
        />
      </form>
    </div>
  );
}
