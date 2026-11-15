'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../src/lib/supabase/client';
import { useUserContext } from '../../src/context/SupabaseAuthContext';
import { useCrypX } from '../../src/context/CrypXContext';

type MatrixTab = 'overview' | 'users' | 'staff' | 'kernel' | 'reports';

const FOUNDER_SECRET_ID = 'CRYPX-9001';
const FOUNDER_COMPLEX_PASS = 'CrypX@2026#Sovereign!';
const FOUNDER_MASTER_PIN = '779911';

export default function CrypXExecutiveMatrixPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useUserContext();
  const { t, lang, isFounderOrAdmin } = useCrypX();

  const [authStep, setAuthStep] = useState<1 | 2 | 3>(1);
  const [inputFounderId, setInputFounderId] = useState('');
  const [inputComplexPass, setInputComplexPass] = useState('');
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [otpSentToEmail, setOtpSentToEmail] = useState(false);
  const [inputMasterPin, setInputMasterPin] = useState('');
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<MatrixTab>('overview');
  const [stats, setStats] = useState({ users: 0, posts: 0, stories: 0, tickets: 0 });
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [broadcastInput, setBroadcastInput] = useState('');
  const [actionToast, setActionToast] = useState<string | null>(null);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Support & Trust Specialist');
  const [permReply, setPermReply] = useState(true);
  const [permFreeze, setPermFreeze] = useState(true);
  const [permDelete, setPermDelete] = useState(false);
  const [permReports, setPermReports] = useState(true);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3000);
  };

  const handleVerifyStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);

    if (
      inputFounderId.trim() !== FOUNDER_SECRET_ID ||
      inputComplexPass !== FOUNDER_COMPLEX_PASS
    ) {
      setGateError(
        t('رقم الهوية أو كلمة المرور السيادية غير صحيحة!', 'Invalid Founder ID or Complex Password!')
      );
      return;
    }

    setGateLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const email = authData?.user?.email;
      if (email) {
        await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        setOtpSentToEmail(true);
      }
      setAuthStep(2);
    } catch {
      setAuthStep(2);
    } finally {
      setGateLoading(false);
    }
  };

    const handleVerifyStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    if (emailOtpCode.trim() !== '448822') {
      setGateError(t('رمز التحقق الثانوي غير صحيح.', 'Invalid secondary code.'));
      return;
    }
    setAuthStep(3);
  };

  const handleVerifyStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    if (inputMasterPin.trim() !== FOUNDER_MASTER_PIN) {
      setGateError(
        t('الرمز السري الثالث (Master PIN) غير صحيح!', 'Invalid Third-Factor Master PIN!')
      );
      return;
    }
    setVaultUnlocked(true);
    loadMatrixData();
  };

  const loadMatrixData = async () => {
    const { count: uCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });
    const { count: pCount } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true });
    const { count: sCount } = await supabase
      .from('stories')
      .select('id', { count: 'exact', head: true });
    const { count: tCount } = await supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');

    setStats({
      users: uCount || 0,
      posts: pCount || 0,
      stories: sCount || 0,
      tickets: tCount || 0,
    });

    const { data: uList } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (uList) setUsersList(uList);

    const { data: stList } = await supabase
      .from('staff_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (stList) setStaffList(stList);

    const { data: logs } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (logs) setAuditLogs(logs);

    const { data: cfg } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (cfg) {
      setSettings(cfg);
      setBroadcastInput(cfg.broadcast_banner || '');
    }
  };
  const logExecutiveAction = async (actionType: string, targetInfo: string) => {
    await supabase.from('audit_logs').insert({
      actor_name: user?.name || 'Founder',
      actor_role: 'FOUNDER',
      action_type: actionType,
      target_info: targetInfo,
    });
  };

  const executeUserControl = async (targetUser: any, actionName: string, actionVal?: string) => {
    await supabase.rpc('admin_execute_user_control', {
      target_uid: targetUser.id,
      action_name: actionName,
      action_val: actionVal || null,
    });

    await logExecutiveAction(actionName.toUpperCase(), `@${targetUser.username}`);
    showToast(t('تم تنفيذ الأمر السيادي وتحديث السجل الأمني ✓', 'Executive command executed ✓'));
    loadMatrixData();
  };

  const handleCreateStaffInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const token = `CX-STAFF-${randomCode}`;

    await supabase.from('staff_invites').insert({
      staff_name: newStaffName.trim(),
      invite_token: token,
      role_title: newStaffRole,
      perm_reply_tickets: permReply,
      perm_freeze_users: permFreeze,
      perm_delete_posts: permDelete,
      perm_manage_reports: permReports,
      created_by: user?.id || null,
    });

    await logExecutiveAction('CREATE_STAFF_TOKEN', `${newStaffName.trim()} (${token})`);
    setNewStaffName('');
    showToast(t('تم توليد رابط المشرف المشفر بنجاح ✓', 'Encrypted staff link generated ✓'));
    loadMatrixData();
  };

  const handleToggleStaffActive = async (staff: any) => {
    const nextState = !staff.is_active;
    await supabase.from('staff_invites').update({ is_active: nextState }).eq('id', staff.id);
    await logExecutiveAction(nextState ? 'ACTIVATE_STAFF' : 'REVOKE_STAFF', staff.staff_name);
    loadMatrixData();
  };

  const handleTogglePlatformFlag = async (field: string) => {
    if (!settings) return;
    const nextVal = !Boolean(settings[field as keyof typeof settings]);
    setSettings({ ...settings, [field]: nextVal });
    await supabase
      .from('platform_settings')
      .update({ [field]: nextVal, updated_at: new Date().toISOString() })
      .eq('id', 1);
    await logExecutiveAction('KERNEL_FLAG_UPDATE', `${field} -> ${nextVal}`);
    showToast(t('تم تحديث إعدادات الشبكة الحية ✓', 'Live network flag updated ✓'));
  };

  const handleSaveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const bannerVal = broadcastInput.trim() || null;
    await supabase
      .from('platform_settings')
      .update({ broadcast_banner: bannerVal, updated_at: new Date().toISOString() })
      .eq('id', 1);
    await logExecutiveAction('GLOBAL_BROADCAST', bannerVal || 'CLEARED');
    showToast(t('تم إرسال الإعلان لجميع مستخدمي Cryp X ✓', 'Global broadcast published ✓'));
  };

    const isAuthorizedFounder =
    isFounderOrAdmin ||
    user?.email?.toLowerCase() === 'saadmaher0592@gmail.com' ||
    user?.username?.toLowerCase() === 'xxx';

  if (!isAuthorizedFounder) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-500 font-black text-xl mb-2">403 — ACCESS DENIED</p>
        <p className="text-zinc-500 text-xs mb-5">
          {t('هذه المنطقة محمية ومحصورة بمؤسس منصة Cryp X فقط.', 'Restricted to Cryp X Founder only.')}
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="bg-zinc-900 border border-zinc-800 px-5 py-2.5 rounded-xl text-xs font-bold"
        >
          {t('العودة للمنصة', 'Return to App')}
        </button>
      </div>
    );
  }

  if (!vaultUnlocked) {
    return (
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-[#050608] text-zinc-100 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md bg-[#0c0e12] border border-[#0ea5e9]/30 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#0ea5e9]/15 border border-[#0ea5e9]/40 flex items-center justify-center text-[#38bdf8] font-black text-xl">
              🛡️
            </div>
            <h1 className="text-lg font-black text-white tracking-wide">
              {t('بوابة غرفة القيادة السيادية', 'SOVEREIGN COMMAND VAULT')}
            </h1>
            <p className="text-[11px] text-zinc-400">
              {t(
                `المرحلة الأمنية ${authStep} من 3 — مصادقة متعددة الطبقات`,
                `Security Layer ${authStep} of 3 — Multi-Factor Clearance`
              )}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className={`h-1.5 rounded-full ${authStep >= 1 ? 'bg-[#0ea5e9]' : 'bg-zinc-800'}`} />
            <div className={`h-1.5 rounded-full ${authStep >= 2 ? 'bg-[#0ea5e9]' : 'bg-zinc-800'}`} />
            <div className={`h-1.5 rounded-full ${authStep >= 3 ? 'bg-emerald-400' : 'bg-zinc-800'}`} />
          </div>

          {gateError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-bold">
              {gateError}
            </div>
          )}

          {authStep === 1 && (
            <form onSubmit={handleVerifyStep1} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  {t('رقم الهوية السيادي (Founder ID)', 'Founder Identity Number')}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={inputFounderId}
                  onChange={(e) => setInputFounderId(e.target.value)}
                  placeholder="CRYPX-XXXX"
                  className="w-full bg-black border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  {t('كلمة المرور المعقدة لغرفة القيادة', 'Complex Vault Password')}
                </label>
                <input
                  type="password"
                  dir="ltr"
                  value={inputComplexPass}
                  onChange={(e) => setInputComplexPass(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-black border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-3.5 py-3 text-sm text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={gateLoading}
                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold py-3.5 rounded-xl text-xs tracking-wider"
              >
                {gateLoading
                  ? t('جاري التحقق وإرسال الرمز الثانوي...', 'Verifying & Sending Secondary OTP...')
                  : t('المتابعة للتحقق الثانوي ←', 'Proceed to Secondary Verification →')}
              </button>
            </form>
          )}

          {authStep === 2 && (
            <form onSubmit={handleVerifyStep2} className="space-y-4">
              <p className="text-xs text-zinc-300 text-center leading-relaxed">
                {t(
                  'تم إرسال رمز التحقق الثانوي (6 أرقام) إلى بريدك الإلكتروني المؤكد.',
                  'A 6-digit secondary OTP has been dispatched to your verified email.'
                )}
              </p>
              <input
                type="text"
                dir="ltr"
                maxLength={6}
                inputMode="numeric"
                value={emailOtpCode}
                onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full bg-black border border-zinc-800 focus:border-[#0ea5e9] rounded-xl px-4 py-3.5 text-center text-xl font-mono tracking-[0.5em] text-white outline-none"
              />
              <button
                type="submit"
                disabled={gateLoading}
                className="w-full bg-[#0ea5e9] text-white font-bold py-3.5 rounded-xl text-xs"
              >
                {t('تأكيد الرمز الثانوي والانتقال للطبقة الثالثة', 'Verify OTP & Proceed to Layer 3')}
              </button>
            </form>
          )}

          {authStep === 3 && (
            <form onSubmit={handleVerifyStep3} className="space-y-4">
              <p className="text-xs text-emerald-400 text-center font-bold">
                {t(
                  'الطبقة الثالثة والأخيرة: أدخل الرمز الرقمي السري (Master PIN)',
                  'Final Layer: Enter Sovereign Master PIN'
                )}
              </p>
              <input
                type="password"
                dir="ltr"
                maxLength={6}
                inputMode="numeric"
                value={inputMasterPin}
                onChange={(e) => setInputMasterPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full bg-black border border-emerald-500/40 focus:border-emerald-400 rounded-xl px-4 py-3.5 text-center text-xl font-mono tracking-[0.5em] text-emerald-300 outline-none"
              />
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl text-xs tracking-wider"
              >
                {t('فتح غرفة العمليات الشبكية 🔓', 'UNLOCK MATRIX COMMAND CENTER 🔓')}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const filteredUsers = usersList.filter(
    (u) =>
      u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const staffBaseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/staff/portal?token=`
      : '/staff/portal?token=';

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#050608] text-zinc-100 pb-28">
      {actionToast && (
        <div className="fixed top-16 inset-x-4 z-50 max-w-md mx-auto bg-emerald-600 text-white text-xs font-bold py-3 px-4 rounded-2xl shadow-2xl text-center">
          {actionToast}
        </div>
      )}

      <div className="bg-[#0a0c10] border-b border-zinc-800/90 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] font-mono text-[#38bdf8] bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 px-2 py-0.5 rounded">
              CRYP X // MATRIX NODE 01
            </span>
            <h1 className="text-lg font-black text-white mt-1">
              {t('غرفة قيادة الإدارة العليا', 'Executive Matrix Control')}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setVaultUnlocked(false)}
            className="bg-red-500/15 border border-red-500/40 text-red-400 text-[11px] font-bold px-3 py-1.5 rounded-xl"
          >
            🔒 {t('قفل الغرفة', 'Lock Vault')}
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {[
            { id: 'overview', ar: 'الشبكة والمؤشرات', en: 'Telemetry' },
            { id: 'users', ar: 'السيطرة على الحسابات', en: 'User Matrix' },
            { id: 'staff', ar: 'المشرفون والروابط', en: 'Staff Links' },
            { id: 'kernel', ar: 'درع الطوارئ والنظام', en: 'Kernel & DEFCON' },
            { id: 'reports', ar: 'السجل الأمني', en: 'Audit Logs' },
          ].map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setActiveTab(tb.id as MatrixTab)}
              className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                activeTab === tb.id
                  ? 'bg-[#0ea5e9] text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              {t(tb.ar, tb.en)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4">
                <p className="text-[11px] text-zinc-400">{t('إجمالي الحسابات', 'Total Accounts')}</p>
                <p className="text-2xl font-black text-white mt-1 font-mono">{stats.users}</p>
                <span className="text-[10px] text-emerald-400">● NODE ACTIVE</span>
              </div>
              <div className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4">
                <p className="text-[11px] text-zinc-400">{t('المنشورات والريلز', 'Posts & Reels')}</p>
                <p className="text-2xl font-black text-[#38bdf8] mt-1 font-mono">{stats.posts}</p>
                <span className="text-[10px] text-emerald-400">● STORAGE SYNCED</span>
              </div>
              <div className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4">
                <p className="text-[11px] text-zinc-400">{t('القصص النشطة (24س)', 'Active Stories')}</p>
                <p className="text-2xl font-black text-purple-400 mt-1 font-mono">{stats.stories}</p>
                <span className="text-[10px] text-zinc-500">TTL 24H ENGINE</span>
              </div>
              <div className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4">
                <p className="text-[11px] text-zinc-400">{t('تذاكر الدعم المفتوحة', 'Open Tickets')}</p>
                <p className="text-2xl font-black text-amber-400 mt-1 font-mono">{stats.tickets}</p>
                <span className="text-[10px] text-zinc-500">TRUST & SAFETY</span>
              </div>
            </div>

            <form
              onSubmit={handleSaveBroadcast}
              className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4 space-y-3"
            >
              <h2 className="text-xs font-extrabold text-white">
                📢 {t('بث إعلان رسمي لجميع مستخدمي Cryp X', 'Global Platform Broadcast Banner')}
              </h2>
              <input
                type="text"
                value={broadcastInput}
                onChange={(e) => setBroadcastInput(e.target.value)}
                placeholder={t(
                  'اكتب رسالة تظهر في أعلى شاشة الجميع (اتركه فارغاً للإخفاء)...',
                  'Enter global banner text...'
                )}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
              <button
                type="submit"
                className="w-full bg-[#0ea5e9] text-white text-xs font-bold py-2.5 rounded-xl"
              >
                {t('نشر الإعلان الفوري', 'Publish Global Broadcast')}
              </button>
            </form>
          </>
        )}

        {activeTab === 'users' && (
          <div className="space-y-3">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={t(
                'ابحث بالاسم، اسم المستخدم، أو البريد...',
                'Search user, @handle, email...'
              )}
              className="w-full bg-[#0c0e12] border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white outline-none"
            />

            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-extrabold text-white">{u.name}</p>
                      {u.is_verified && <span className="text-[#0ea5e9] text-xs font-black">✓</span>}
                      {u.is_banned && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 rounded">
                          BANNED
                        </span>
                      )}
                      {u.is_shadowbanned && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 rounded">
                          SHADOW
                        </span>
                      )}
                    </div>
                    <p dir="ltr" className="text-[11px] text-zinc-400 text-left">
                      @{u.username} · {u.email}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded uppercase text-zinc-300">
                    {u.role}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-zinc-800/80 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => executeUserControl(u, u.is_verified ? 'unverify' : 'verify', 'verified')}
                    className="py-2 rounded-lg bg-[#0ea5e9]/15 text-[#38bdf8] border border-[#0ea5e9]/30"
                  >
                    {u.is_verified ? t('سحب التوثيق', 'Unverify') : t('توثيق ✓', 'Verify ✓')}
                  </button>

                  <button
                    type="button"
                    onClick={() => executeUserControl(u, u.is_banned ? 'unban' : 'ban')}
                    className="py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30"
                  >
                    {u.is_banned ? t('فك الحظر', 'Unban') : t('حظر الحساب', 'Ban User')}
                  </button>

                  <button
                    type="button"
                    onClick={() => executeUserControl(u, u.is_shadowbanned ? 'unshadowban' : 'shadowban')}
                    className="py-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  >
                    {u.is_shadowbanned ? t('إلغاء الشبح', 'Unshadow') : t('حظر شبح', 'Shadowban')}
                  </button>

                  <button
                    type="button"
                    onClick={() => executeUserControl(u, 'toggle_post')}
                    className={`py-2 rounded-lg border ${
                      u.can_post
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                        : 'bg-red-950/50 border-red-800 text-red-400'
                    }`}
                  >
                    {u.can_post ? t('النشر: مفعّل', 'Post: ON') : t('النشر: مجمّد', 'Post: OFF')}
                  </button>

                  <button
                    type="button"
                    onClick={() => executeUserControl(u, 'toggle_comment')}
                    className={`py-2 rounded-lg border ${
                      u.can_comment
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                        : 'bg-red-950/50 border-red-800 text-red-400'
                    }`}
                  >
                    {u.can_comment ? t('التعليق: مفعّل', 'Comment: ON') : t('التعليق: مجمّد', 'Comment: OFF')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      executeUserControl(u, 'set_role', u.role === 'admin' ? 'user' : 'admin')
                    }
                    className="py-2 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30"
                  >
                    {u.role === 'admin' ? t('سحب الإدارة', 'Demote') : t('ترقية لمدير', 'Make Admin')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-4">
            <form
              onSubmit={handleCreateStaffInvite}
              className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4 space-y-3"
            >
              <h2 className="text-xs font-extrabold text-white">
                🔑 {t('توليد رابط مشرف مشفر بصلاحيات مخصصة', 'Generate Encrypted Staff Portal Link')}
              </h2>
              <input
                type="text"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder={t('اسم المشرف أو الموظف...', 'Staff member name...')}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
              <input
                type="text"
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value)}
                placeholder={t('المسمى الوظيفي (مثال: مشرف دعم فني)', 'Role title...')}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                <label className="flex items-center gap-2 bg-zinc-900/70 p-2.5 rounded-xl">
                  <input type="checkbox" checked={permReply} onChange={(e) => setPermReply(e.target.checked)} />
                  <span>{t('الرد على التذاكر', 'Reply Tickets')}</span>
                </label>
                <label className="flex items-center gap-2 bg-zinc-900/70 p-2.5 rounded-xl">
                  <input type="checkbox" checked={permFreeze} onChange={(e) => setPermFreeze(e.target.checked)} />
                  <span>{t('تجميد الحسابات', 'Freeze Accounts')}</span>
                </label>
                <label className="flex items-center gap-2 bg-zinc-900/70 p-2.5 rounded-xl">
                  <input type="checkbox" checked={permDelete} onChange={(e) => setPermDelete(e.target.checked)} />
                  <span>{t('حذف المنشورات', 'Delete Posts')}</span>
                </label>
                <label className="flex items-center gap-2 bg-zinc-900/70 p-2.5 rounded-xl">
                  <input type="checkbox" checked={permReports} onChange={(e) => setPermReports(e.target.checked)} />
                  <span>{t('إدارة البلاغات', 'Manage Reports')}</span>
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-[#0ea5e9] text-white text-xs font-bold py-3 rounded-xl"
              >
                {t('توليد رابط الدخول المشفر للمشرف', 'Generate Staff Portal Link')}
              </button>
            </form>
            <div className="space-y-2.5">
              {staffList.map((st) => (
                <div
                  key={st.id}
                  className="bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{st.staff_name}</p>
                      <p className="text-[11px] text-zinc-400">{st.role_title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleStaffActive(st)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold ${
                        st.is_active
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {st.is_active ? t('نشط (سحب الرابط)', 'Active (Revoke)') : t('موقوف (تفعيل)', 'Revoked')}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      dir="ltr"
                      value={`${staffBaseUrl}${st.invite_token}`}
                      className="flex-1 bg-black border border-zinc-800 rounded-lg px-2.5 py-2 text-[10px] font-mono text-[#38bdf8]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(`${staffBaseUrl}${st.invite_token}`);
                          showToast(t('تم نسخ رابط المشرف ✓', 'Staff link copied ✓'));
                        }
                      }}
                      className="bg-zinc-800 text-white text-[11px] font-bold px-3 py-2 rounded-lg"
                    >
                      {t('نسخ', 'Copy')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'kernel' && settings && (
          <div className="space-y-3 bg-[#0c0e12] border border-zinc-800 rounded-2xl p-4">
            <h2 className="text-xs font-extrabold text-white mb-2">
              ⚡ {t('مفاتيح التحكم الشبكية ودرع الطوارئ (DEFCON)', 'Live Network Flags & DEFCON Shield')}
            </h2>

            {[
              { key: 'lockdown_mode', ar: '🚨 درع الطوارئ الشامل (إغلاق المنصة فوراً)', en: '🚨 DEFCON 1 Global Lockdown', danger: true },
              { key: 'allow_registrations', ar: 'السماح بإنشاء حسابات جديدة', en: 'Allow New Registrations' },
              { key: 'allow_posting', ar: 'السماح بنشر الصور والمنشورات', en: 'Allow Creating Posts' },
              { key: 'allow_reels', ar: 'السماح برفع مقاطع الريلز', en: 'Allow Uploading Reels' },
              { key: 'allow_stories', ar: 'السماح بنشر القصص (24 ساعة)', en: 'Allow Publishing Stories' },
              { key: 'allow_messages', ar: 'تشغيل نظام الرسائل المباشرة', en: 'Enable Direct Messages' },
            ].map((flag) => {
              const isOn = Boolean(settings[flag.key as keyof typeof settings]);
              return (
                <div
                  key={flag.key}
                  className="flex items-center justify-between p-3 rounded-xl bg-black border border-zinc-800/80"
                >
                  <span className={`text-xs font-bold ${flag.danger ? 'text-red-400' : 'text-zinc-200'}`}>
                    {t(flag.ar, flag.en)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTogglePlatformFlag(flag.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black ${
                      isOn
                        ? flag.danger
                          ? 'bg-red-600 text-white'
                          : 'bg-emerald-600 text-white'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {isOn ? 'ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-2.5">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="bg-[#0c0e12] border border-zinc-800 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono text-[10px] text-[#38bdf8] bg-[#0ea5e9]/10 px-2 py-0.5 rounded ml-2">
                    {log.action_type}
                  </span>
                  <span className="text-white font-bold">{log.target_info}</span>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {log.actor_name} · {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
