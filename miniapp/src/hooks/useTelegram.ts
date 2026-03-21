import { useEffect, useState } from 'react';

// ============================================================
// Хук для Telegram Web App SDK
// ============================================================

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    setText: (text: string) => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light'|'medium'|'heavy'|'rigid'|'soft') => void;
    notificationOccurred: (type: 'error'|'success'|'warning') => void;
    selectionChanged: () => void;
  };
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback: (ok: boolean) => void) => void;
}

export function useTelegram() {
  const tg = window.Telegram?.WebApp;
  const [user, setUser] = useState(tg?.initDataUnsafe?.user || null);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      setUser(tg.initDataUnsafe?.user || null);
    }
  }, []);

  return {
    tg,
    user,
    initData: tg?.initData || '',
    startParam: tg?.initDataUnsafe?.start_param,
    haptic: tg?.HapticFeedback,
  };
}
