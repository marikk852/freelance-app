import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { Toaster } from 'react-hot-toast';
import { BottomNav }   from './components/BottomNav';
import { FloatingParticles } from './components/FloatingParticles';
import { NotificationPopup } from './components/NotificationPopup';
import { Home }        from './pages/Home';
import { NewDeal }     from './pages/NewDeal';
import { DealRoom }    from './pages/DealRoom';
import { Payment }     from './pages/Payment';
import { Review }      from './pages/Review';
import { Dispute }     from './pages/Dispute';
import { LiveDeals }   from './pages/LiveDeals';
import { Profile }     from './pages/Profile';
import { JobBoard }    from './pages/JobBoard';
import { JoinDeal }    from './pages/JoinDeal';
import { MyDeals }        from './pages/MyDeals';
import { PublicProfile }   from './pages/PublicProfile';
import { FreelancerList }  from './pages/FreelancerList';
import { Notifications }   from './pages/Notifications';
import { Quests }          from './pages/Quests';
import { Board }           from './pages/Board';
import { Subscription }    from './pages/Subscription';
import { Crystals }        from './pages/Crystals';
import { MilestoneDeal }   from './pages/MilestoneDeal';
import { MilestoneGroup }  from './pages/MilestoneGroup';
import './styles/globals.css';

// ============================================================
// Кнопка расширения до десктоп-режима (видна только в мобильной версии на ПК)
// Показывается когда: ширина окна < 900px И есть Telegram WebApp API
// ============================================================
function ExpandButton() {
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 900);

  // Следим за изменением ширины
  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Не показывать на реальных мобильных устройствах (только десктопные браузеры/Telegram Desktop)
  const isTelegramDesktop = !!(window as any).Telegram?.WebApp &&
    !(/(android|iphone|ipad|mobile)/i.test(navigator.userAgent));

  const expand = useCallback(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;
    if (tg.requestFullscreen) {
      tg.requestFullscreen();
    } else {
      tg.expand?.();
    }
  }, []);

  if (!isMobileView || !isTelegramDesktop) return null;

  return (
    <button
      onClick={expand}
      title="Desktop mode"
      style={{
        position      : 'fixed',
        bottom        : '80px',
        right         : '12px',
        zIndex        : 9000,
        width         : '32px',
        height        : '32px',
        padding       : 0,
        borderRadius  : '8px',
        background    : 'rgba(0,0,0,0.9)',
        border        : '1px solid rgba(0,255,136,0.4)',
        color         : '#00ff88',
        cursor        : 'pointer',
        display       : 'flex',
        alignItems    : 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(12px)',
        boxShadow     : '0 0 10px rgba(0,255,136,0.15)',
        transition    : 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,255,136,0.9)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(0,255,136,0.4)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,255,136,0.4)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 10px rgba(0,255,136,0.15)';
      }}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M9 1h4v4M5 13H1V9M1 5V1h4M13 9v4H9"/>
      </svg>
    </button>
  );
}

// ============================================================
// Экран технического обслуживания
// ============================================================
function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      textAlign: 'center',
      fontFamily: '"Press Start 2P", monospace',
    }}>
      <div style={{ fontSize: '64px', marginBottom: '32px' }}>🔧</div>
      <div style={{
        fontSize: '14px',
        color: '#FFAA00',
        marginBottom: '20px',
        letterSpacing: '2px',
      }}>MAINTENANCE</div>
      <div style={{
        fontSize: '8px',
        color: 'rgba(255,255,255,0.7)',
        lineHeight: '1.8',
        maxWidth: '280px',
      }}>{message || 'Platform is temporarily unavailable. We\'ll be back soon!'}</div>
      <div style={{
        marginTop: '40px',
        width: '48px',
        height: '4px',
        background: 'linear-gradient(90deg, #00FF88, #FFAA00)',
        borderRadius: '2px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
    </div>
  );
}

// ============================================================
// Обработчик invite-ссылки ?room=UUID
// Запускается при старте — если есть ?room=, показываем JoinDeal
// ============================================================
// Карта ?screen= → маршрут (бот открывает mini app кнопками web_app с этим параметром)
const SCREEN_ROUTES: Record<string, string> = {
  profile     : '/profile',
  new_deal    : '/new-deal',
  job_board   : '/jobs',
  subscription: '/subscription',
  crystals    : '/crystals',
  review      : '/review', // требует ?id=
};

function InviteHandler() {
  const navigate = useNavigate();
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Читаем ?room= из URL
    const room = params.get('room');
    // Также проверяем start_param Telegram (когда открыто через t.me/bot?startapp=...)
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;

    const link = room || startParam || null;
    if (link) {
      setInviteLink(link);
      navigate(`/join/${link}`, { replace: true });
      return;
    }

    // Глубокая ссылка из бота: ?screen=subscription, ?screen=review&id=...
    const screen = params.get('screen');
    if (screen && SCREEN_ROUTES[screen]) {
      const screenId = params.get('id');
      const base     = SCREEN_ROUTES[screen];
      navigate(screenId ? `${base}/${screenId}` : base, { replace: true });
    }
  }, []);

  return null;
}

export default function App() {
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch('/admark/status')
      .then(r => r.json())
      .then(data => {
        if (data.maintenance) {
          setMaintenance({ active: true, message: data.message || '' });
        } else {
          setMaintenance({ active: false, message: '' });
        }
      })
      .catch(() => setMaintenance({ active: false, message: '' }));
  }, []);

  // Пока не знаем статус — ничего не рендерим (избегаем мигания)
  if (maintenance === null) return null;

  if (maintenance.active) {
    return <MaintenanceScreen message={maintenance.message} />;
  }

  return (
    <TonConnectUIProvider manifestUrl="https://freelance-app-production.up.railway.app/tonconnect-manifest.json">
    <BrowserRouter>
      <InviteHandler />
      <FloatingParticles />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background   : 'rgba(0,0,0,0.95)',
            border       : '1px solid rgba(0,255,136,0.4)',
            color        : '#fff',
            fontFamily   : '"Press Start 2P", monospace',
            fontSize     : '8px',
            borderRadius : '7px',
            backdropFilter: 'blur(16px)',
            boxShadow    : '0 0 24px rgba(0,255,136,0.2)',
          },
          success: { iconTheme: { primary: '#00FF88', secondary: '#000' } },
          error  : { iconTheme: { primary: '#FF4466', secondary: '#000' } },
        }}
      />

      <NotificationPopup />
      <ExpandButton />
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/new-deal"    element={<NewDeal />} />
        <Route path="/join/:link"  element={<JoinDeal />} />
        <Route path="/deal/:id"    element={<DealRoom />} />
        <Route path="/payment/:id" element={<Payment />} />
        <Route path="/review/:id"  element={<Review />} />
        <Route path="/dispute/:id" element={<Dispute />} />
        <Route path="/live"        element={<LiveDeals />} />
        <Route path="/profile"     element={<Profile />} />
        <Route path="/profile/:telegramId" element={<PublicProfile />} />
        <Route path="/jobs"          element={<Board />} />
        <Route path="/board"         element={<Board />} />
        <Route path="/my-deals"      element={<MyDeals />} />
        <Route path="/freelancers"   element={<Board />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/quests"        element={<Quests />} />
        <Route path="/subscription"  element={<Subscription />} />
        <Route path="/crystals"      element={<Crystals />} />
        <Route path="/new-milestone" element={<MilestoneDeal />} />
        <Route path="/group/:groupId" element={<MilestoneGroup />} />
      </Routes>

      <BottomNav />
    </BrowserRouter>
    </TonConnectUIProvider>
  );
}
