'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '../../../src/lib/supabase/client';
import { useCrypX } from '../../../src/context/CrypXContext';

function StaffPortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';
  const router = useRouter();
  const supabase = createClient();
  const { t, lang } = useCrypX();

  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invalidToken, setInvalidToken] = useState(false);

  const [usersList, setUsersList] = useState<any[]>([]);
  const [postsList, setPostsList] = useState<any[]>([]);
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    verifyAndLoadStaff();
  }, [token]);

  const verifyAndLoadStaff = async () => {
    if (!token.trim()) {
      setInvalidToken(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: invite } = await supabase
        .from('staff_invites')
        .select('*')
        .eq('invite_token', token.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (!invite) {
        setInvalidToken(true);
        setLoading(false);
        return;
      }

      setStaff(invite);

      if (invite.perm_freeze_users) {
        const { data: uData } = await supabase
          .from('users')
          .select('id, name, username, is_banned, can_post, role')
          .neq('role', 'founder')
          .order('created_at', { ascending: false })
          .limit(30);
        if (uData) setUsersList(uData);
      }

      if (invite.perm_delete_posts) {
        const { data: pData } = await supabase
          .from('posts')
          .select('id, caption, image_url, created_at')
          .order('created_at', { ascending: false })
          .limit(20);
        if (pData) setPostsList(pData);
      }

      if (invite.perm_reply_tickets || invite.perm_manage_reports) {
        const { data: tData } = await supabase
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);
        if (tData) setTicketsList(tData);
      }
    } catch {
      setInvalidToken(true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFreezeUser = async (target: any) => {
    const nextBanned = !target.is_banned;
    await supabase.from('users').update({ is_banned: nextBanned }).eq('id', target.id);
    await supabase.from('audit_logs').insert({
      actor_name: staff.staff_name,
      actor_role: 'STAFF',
      action_type: nextBanned ? 'STAFF_FREEZE_USER' : 'STAFF_UNFREEZE_USER',
      target_info: `@${target.username}`,
    });
    setUsersList((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, is_banned: nextBanned } : u))
    );
    notify(t('تم تحديث حالة الحساب وتسجيل العملية للإدارة ✓', 'Account status updated & logged ✓'));
  };

  const handleDeletePost = async (postId: string) => {
    await supabase.from('posts').delete().eq('id', postId);
    await supabase.from('audit_logs').insert({
      actor_name: staff.staff_name,
      actor_role: 'STAFF',
      action_type: 'STAFF_DELETE_POST',
      target_info: `Post ${postId.slice(0, 8)}`,
    });
    setPostsList((prev) => prev.filter((p) => p.id !== postId));
    notify(t('تم حذف المنشور المخالف ✓', 'Post deleted ✓'));
  };

  const handleReplyTicket = async (ticketId: string) => {
    const reply = (replyTexts[ticketId] || '').trim();
    if (!reply) return;

    await supabase
      .from('support_tickets')
      .update({ admin_reply: reply, status: 'closed' })
      .eq('id', ticketId);

    await supabase.from('audit_logs').insert({
      actor_name: staff.staff_name,
      actor_role: 'STAFF',
      action_type: 'STAFF_REPLY_TICKET',
      target_info: `Ticket ${ticketId.slice(0, 8)}`,
    });

    setTicketsList((prev) =>
      prev.map((tk) =>
        tk.id === ticketId ? { ...tk, admin_reply: reply, status: 'closed' } : tk
      )
    );
    notify(t('تم إرسال الرد وإغلاق التذكرة ✓', 'Reply sent & ticket closed ✓'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (invalidToken || !staff) {
    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-[#050608] text-white flex flex-col items-center justify-center p-6 text-center"
      >
        <p className="text-red-500 font-black text-xl mb-2">
          {t('رابط المشرف غير صالح أو تم سحبه', 'Invalid or Revoked Staff Link')}
        </p>
        <p className="text-zinc-400 text-xs max-w-xs mb-5">
          {t(
            'يرجى مراجعة مؤسس منصة Cryp X للحصول على رابط دخول مشفر نشط.',
            'Please contact the Cryp X Founder for an active encrypted link.'
          )}
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="bg-zinc-900 border border-zinc-800 px-5 py-2.5 rounded-xl text-xs font-bold"
        >
          {t('العودة للمنصة', 'Return to Cryp X')}
        </button>
      </div>
    );
  }

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#050608] text-zinc-100 pb-20">
      {toastMsg && (
        <div className="fixed top-4 inset-x-4 z-50 max-w-md mx-auto bg-emerald-600 text-white text-xs font-bold py-3 px-4 rounded-2xl text-center shadow-2xl">
          {toastMsg}
        </div>
      )}

      <div className="bg-[#0a0c10] border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-[#38bdf8] bg-[#0ea5e9]/10 px-2 py-0.5 rounded">
            CRYP X // STAFF PORTAL
          </span>
          <h1 className="text-base font-black text-white mt-1">
            {t('مرحباً،', 'Welcome,')} {staff.staff_name}
          </h1>
          <p className="text-[11px] text-zinc-400">{staff.role_title}</p>
        </div>
        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
          ● {t('جلسة مراقبة', 'AUDITED')}
        </span>
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-6">
        {staff.perm_freeze_users && (
          <section className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-extrabold text-white">
              🛡️ {t('صلاحية تجميد وفك تجميد الحسابات', 'User Freeze Control')}
            </h2>
            <div className="space-y-2">
              {usersList.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-black border border-zinc-800/80"
                >
                  <div>
                    <p className="text-xs font-bold text-white">{u.name}</p>
                    <p dir="ltr" className="text-[11px] text-zinc-400 text-left">
                      @{u.username}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFreezeUser(u)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                      u.is_banned
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {u.is_banned ? t('فك التجميد', 'Unfreeze') : t('تجميد الحساب', 'Freeze')}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {staff.perm_delete_posts && (
          <section className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-extrabold text-white">
              🗑️ {t('صلاحية إزالة المنشورات المخالفة', 'Content Moderation')}
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              {postsList.map((p) => (
                <div key={p.id} className="bg-black border border-zinc-800 rounded-xl p-2 space-y-2">
                  <img src={p.image_url} alt="Post" className="w-full h-28 object-cover rounded-lg" />
                  <p className="text-[11px] text-zinc-300 truncate">{p.caption || 'No caption'}</p>
                  <button
                    type="button"
                    onClick={() => handleDeletePost(p.id)}
                    className="w-full py-1.5 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-bold"
                  >
                    {t('حذف المنشور', 'Delete Post')}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {(staff.perm_reply_tickets || staff.perm_manage_reports) && (
          <section className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-extrabold text-white">
              📩 {t('تذاكر الدعم وبلاغات المستخدمين', 'Support Tickets & Reports')}
            </h2>
            {ticketsList.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">
                {t('لا توجد تذاكر دعم مفتوحة حالياً.', 'No support tickets right now.')}
              </p>
            ) : (
              ticketsList.map((tk) => (
                <div key={tk.id} className="bg-black border border-zinc-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">{tk.subject}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {tk.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{tk.message}</p>
                  {tk.admin_reply ? (
                    <p className="text-[11px] text-emerald-400 bg-emerald-500/10 p-2 rounded-lg">
                      {t('الرد:', 'Reply:')} {tk.admin_reply}
                    </p>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={replyTexts[tk.id] || ''}
                        onChange={(e) =>
                          setReplyTexts((prev) => ({ ...prev, [tk.id]: e.target.value }))
                        }
                        placeholder={t('اكتب الرد الرسمي...', 'Write official reply...')}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleReplyTicket(tk.id)}
                        className="bg-[#0ea5e9] text-white text-xs font-bold px-3.5 rounded-lg"
                      >
                        {t('إرسال', 'Send')}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default function CrypXStaffPortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <StaffPortalContent />
    </Suspense>
  );
}
