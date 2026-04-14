import { useNavigate, useLocation } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';

const NAV_ITEMS = [
  { path: '/',        label: 'HOME',    icon: '🏠' },
  { path: '/live',    label: 'LIVE',    icon: '📡' },
  { path: '/jobs',    label: 'JOBS',    icon: '📌' },
  { path: '/profile', label: 'PROFILE', icon: '👤' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { tg } = useTelegram();

  const handleNav = (path: string) => {
    tg?.HapticFeedback?.selectionChanged();
    navigate(path);
  };

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => {
        const active = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
        return (
          <button
            key={item.path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => handleNav(item.path)}
            style={{ background:'none', border:'none' }}
          >
            <span style={{ fontSize:'20px', display:'block', transition:'transform 0.2s', transform: active ? 'scale(1.2)' : 'scale(1)' }}>
              {item.icon}
            </span>
            <span style={{ fontSize:'5px' }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
