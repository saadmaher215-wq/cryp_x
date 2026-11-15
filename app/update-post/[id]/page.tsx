'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../src/lib/supabase/client';
import { useCrypX } from '../../../src/context/CrypXContext';

export default function CrypXUpdateProfilePage() {
  const params = useParams();
  const profileId = (params?.id as string) || '';
  const router = useRouter();
  const supabase = createClient();
  const { t, lang } = useCrypX();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [gender, setGender] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');

  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.2);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profileId) {
      loadProfile();
    }
  }, [profileId]);

  const loadProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();

    if (data) {
      setName(data.name || '');
      setUsername(data.username || '');
      setPronouns(data.pronouns || '');
      setCategory(data.category || '');
      setBio(data.bio || '');
      setExternalLink(data.external_link || '');
      setGender(data.gender || '');
      setAvatarPreview(
        data.image_url ||
          'https://ui-avatars.com' +
            encodeURIComponent(data.name || 'User')
      );
    }
    setLoading(false);
  };

  const handleSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.item(0);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setZoom(1.2);
      setOffsetX(0);
      setOffsetY(0);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const applyCircularCrop = () => {
    if (!rawImageSrc) return;
    const img = new Image();
    img.onload = () => {
      const size = 400;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const minDim = Math.min(img.width, img.height);
      const scale = (size / minDim) * zoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (size - drawW) / 2 + offsetX;
      const dy = (size - drawH) / 2 + offsetY;

      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();

      canvas.toBlob(
        (blob) => {
          if (blob) {
            setCroppedBlob(blob);
            setAvatarPreview(URL.createObjectURL(blob));
          }
          setCropperOpen(false);
        },
        'image/png',
        0.95
      );
    };
    img.src = rawImageSrc;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    const cleanUser = username.trim().toLowerCase();

    if (!cleanName || !cleanUser) {
      setErrorMsg(t('الاسم واسم المستخدم مطلوبان.', 'Name and username are required.'));
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      let finalAvatarUrl = avatarPreview;

      if (croppedBlob) {
        const path = `avatars/${profileId}_${Date.now()}.png`;
        const { error: upErr } = await supabase.storage
          .from('media')
          .upload(path, croppedBlob, { contentType: 'image/png', upsert: true });

        if (!upErr) {
          const { data: pubData } = supabase.storage.from('media').getPublicUrl(path);
          finalAvatarUrl = pubData.publicUrl;
        }
      }

      const { error: updateErr } = await supabase
        .from('users')
        .update({
          name: cleanName,
          username: cleanUser,
          pronouns: pronouns.trim() || null,
          category: category.trim() || null,
          bio: bio.trim() || null,
          external_link: externalLink.trim() || null,
          gender: gender.trim() || null,
          image_url: finalAvatarUrl,
        })
        .eq('id', profileId);

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      router.push(`/profile/${profileId}`);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || t('تعذر حفظ التعديلات.', 'Failed to save changes.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-black text-zinc-100 pb-24">
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-zinc-900 px-4 py-3.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-zinc-400 hover:text-white text-sm"
        >
          {t('إلغاء', 'Cancel')}
        </button>
        <h1 className="text-base font-bold text-white">
          {t('تعديل الملف الشخصي', 'Edit Profile')}
        </h1>
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={saving}
          className="text-sm font-bold text-[#0ea5e9] disabled:text-zinc-600"
        >
          {saving ? t('حفظ...', 'Saving...') : t('تم ✓', 'Done ✓')}
        </button>
      </div>

      {errorMsg && (
        <div className="m-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="p-4 max-w-lg mx-auto space-y-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleSelectImage}
          className="hidden"
        />

        {/* الصورة الدائرية */}
        <div className="flex flex-col items-center gap-2.5 pt-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-full p-0.5 bg-gradient-to-tr from-[#0ea5e9] to-emerald-400 cursor-pointer"
          >
            <img
              src={avatarPreview}
              alt="Avatar"
              className="w-full h-full rounded-full object-cover border-2 border-black"
            />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-bold text-[#0ea5e9]"
          >
            {t('تعديل الصورة الدائرية وقصها', 'Edit and Crop Circular Photo')}
          </button>
        </div>

        {/* الحقول الكاملة */}
        <div className="space-y-4 bg-[#121215] border border-zinc-800/80 rounded-2xl p-4">
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">{t('الاسم', 'Name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              {t('اسم المستخدم', 'Username')}
            </label>
            <input
              type="text"
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white text-left outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              {t('الضمائر (اختياري)', 'Pronouns (Optional)')}
            </label>
            <input
              type="text"
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              placeholder={t('مثال: هو / هي', 'e.g. he/him, she/her')}
              className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              {t('السيرة الذاتية (Bio)', 'Bio')}
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('اكتب نبذة عنك أو عن عملك...', 'Write something about yourself...')}
              className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              {t('إضافة رابط خارجي', 'Add External Link')}
            </label>
            <input
              type="text"
              dir="ltr"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://vercel.app"
              className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white text-left outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              {t('الفئة (Category)', 'Category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
            >
              <option value="">{t('اختر الفئة...', 'Select category...')}</option>
              <option value="Founder & CEO">{t('مؤسس ومدير تنفيذي', 'Founder & CEO')}</option>
              <option value="Digital Creator">{t('منشئ محتوى رقمي', 'Digital Creator')}</option>
              <option value="Tech & Software">{t('تقنية وبرمجيات', 'Tech & Software')}</option>
              <option value="Public Figure">{t('شخصية عامة', 'Public Figure')}</option>
              <option value="Business & Brand">{t('شركة وعلامة تجارية', 'Business & Brand')}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">{t('الجنس', 'Gender')}</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
            >
              <option value="">{t('يفضل عدم التحديد', 'Prefer not to say')}</option>
              <option value="Male">{t('ذكر', 'Male')}</option>
              <option value="Female">{t('أنثى', 'Female')}</option>
            </select>
          </div>
        </div>
      </form>

      {/* نافذة أداة القص الدائري التفاعلية (Circular Cropper Modal) */}
      {cropperOpen && rawImageSrc && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-5">
          <div className="w-full max-w-sm flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCropperOpen(false)}
              className="text-zinc-400 text-sm font-bold"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <h2 className="text-sm font-bold text-white">
              {t('قص الصورة الدائرية', 'Crop Circular Photo')}
            </h2>
            <button
              type="button"
              onClick={applyCircularCrop}
              className="text-[#0ea5e9] text-sm font-bold"
            >
              {t('تطبيق ✓', 'Apply ✓')}
            </button>
          </div>

          {/* إطار المعاينة الدائري */}
          <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-[#0ea5e9] bg-zinc-900 shadow-2xl flex items-center justify-center">
            <img
              src={rawImageSrc}
              alt="Crop Preview"
              style={{
                transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
              }}
              className="max-w-none w-full h-full object-cover transition-transform duration-75"
            />
          </div>

          {/* أدوات التكبير والتحريك */}
          <div className="w-full max-w-sm bg-[#121215] border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div>
              <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                <span>{t('التكبير والتصغير', 'Zoom')}</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-[#0ea5e9]"
              />
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setOffsetY((y) => y - 12)}
                className="bg-zinc-900 py-2 rounded-xl text-white"
              >
                ↑ {t('أعلى', 'Up')}
              </button>
              <button
                type="button"
                onClick={() => setOffsetY((y) => y + 12)}
                className="bg-zinc-900 py-2 rounded-xl text-white"
              >
                ↓ {t('أسفل', 'Down')}
              </button>
              <button
                type="button"
                onClick={() => setOffsetX((x) => x - 12)}
                className="bg-zinc-900 py-2 rounded-xl text-white"
              >
                ← {t('يسار', 'Left')}
              </button>
              <button
                type="button"
                onClick={() => setOffsetX((x) => x + 12)}
                className="bg-zinc-900 py-2 rounded-xl text-white"
              >
                → {t('يمين', 'Right')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
