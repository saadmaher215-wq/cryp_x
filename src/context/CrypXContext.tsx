'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '../lib/supabase/client';

export type AppLang = 'ar' | 'en';

interface StoredAccount {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar: string;
}

interface CrypXContextType {
  lang: AppLang;
  setLang: (l: AppLang) => void;
  toggleLang: () => void;
  t: (arText: string, enText: string) => string;
  unreadNotifications: number;
  refreshNotifications: () => Promise<void>;
  savedAccounts: StoredAccount[];
  registerCurrentAccount: (acc: StoredAccount) => void;
  removeSavedAccount: (id: string) => void;
  isFounderOrAdmin: boolean;
  userRole: string;
  badgeType: string | null;
  broadcastBanner: string | null;
  lockdownMode: boolean;
}

const CrypXContext = createContext<CrypXContextType>({
  lang: 'ar',
  setLang: () => {},
  toggleLang: () => {},
  t: (ar) => ar,
  unreadNotifications: 0,
  refreshNotifications: async () => {},
  savedAccounts: [],
  registerCurrentAccount: () => {},
  removeSavedAccount: () => {},
  isFounderOrAdmin: false,
  userRole: 'user',
  badgeType: null,
  broadcastBanner: null,
  lockdownMode: false,
});

export const CrypXProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = createClient();
  const [lang, setLangState] = useState<AppLang>('ar');
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [savedAccounts, setSavedAccounts] = useState<StoredAccount[]>([]);
  const [isFounderOrAdmin, setIsFounderOrAdmin] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('user');
  const [badgeType, setBadgeType] = useState<string | null>(null);
  const [broadcastBanner, setBroadcastBanner] = useState<string | null>(null);
  const [lockdownMode, setLockdownMode] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('crypx_lang') as AppLang | null;
      if (savedLang === 'en' || savedLang === 'ar') {
        setLangState(savedLang);
        document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = savedLang;
      } else {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'ar';
      }

      try {
        const rawAccs = localStorage.getItem('crypx_multi_accounts');
        if (rawAccs) {
          const parsed = JSON.parse(rawAccs);
          if (Array.isArray(parsed)) setSavedAccounts(parsed);
        }
      } catch {
        setSavedAccounts([]);
      }
    }

    loadSystemAndUserState();
  }, []);

  const loadSystemAndUserState = async () => {
    try {
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('lockdown_mode, broadcast_banner')
        .eq('id', 1)
        .maybeSingle();

      if (settings) {
        setLockdownMode(Boolean(settings.lockdown_mode));
        setBroadcastBanner(settings.broadcast_banner || null);
      }

      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) return;

      const { data: profile } = await supabase
        .from('users')
        .select('id, name, username, email, image_url, role, badge_type, is_admin')
        .eq('id', uid)
        .maybeSingle();

      if (profile) {
        const roleVal = profile.role || 'user';
        setUserRole(roleVal);
        setBadgeType(profile.badge_type || null);
        setIsFounderOrAdmin(
          Boolean(profile.is_admin || roleVal === 'founder' || roleVal === 'admin')
        );

        registerCurrentAccount({
          id: profile.id,
          email: profile.email || authData.user?.email || '',
          name: profile.name || 'Cryp X User',
          username: profile.username || 'user',
          avatar:
            profile.image_url ||
            'https://ui-avatars.com' +
              encodeURIComponent(profile.name || 'User'),
        });
      }

      await refreshNotificationsForUser(uid);
    } catch {
      // تجاهل الأخطاء الصامتة
    }
  };

  const refreshNotificationsForUser = async (uid: string) => {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', uid)
        .eq('is_read', false);

      setUnreadNotifications(count || 0);
    } catch {
      setUnreadNotifications(0);
    }
  };

  const refreshNotifications = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      await refreshNotificationsForUser(authData.user.id);
    }
  };

  const setLang = (newLang: AppLang) => {
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crypx_lang', newLang);
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = newLang;
    }
  };

  const toggleLang = () => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  };

  const t = (arText: string, enText: string) => {
    return lang === 'ar' ? arText : enText;
  };

  const registerCurrentAccount = (acc: StoredAccount) => {
    setSavedAccounts((prev) => {
      const filtered = prev.filter((item) => item.id !== acc.id);
      const updated = [acc, ...filtered].slice(0, 5);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crypx_multi_accounts', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const removeSavedAccount = (id: string) => {
    setSavedAccounts((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crypx_multi_accounts', JSON.stringify(updated));
      }
      return updated;
    });
  };

  return (
    <CrypXContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        t,
        unreadNotifications,
        refreshNotifications,
        savedAccounts,
        registerCurrentAccount,
        removeSavedAccount,
        isFounderOrAdmin,
        userRole,
        badgeType,
        broadcastBanner,
        lockdownMode,
      }}
    >
      {children}
    </CrypXContext.Provider>
  );
};

export const useCrypX = () => useContext(CrypXContext);
