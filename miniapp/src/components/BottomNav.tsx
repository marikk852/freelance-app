import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/',         label: 'Home',    icon: '🏠' },
  { path: '/deals',    label: 'Deals',   icon: '⚔️' },
  { path: '/live',     label: 'Live',    icon: '📡' },
  { path: '/jobs',     label: 'Jobs',    icon: '📌' },
  { path: '/profile',  label: 'Profile', icon: '👤' },
];

/** Нижняя навигация — присутствует на всех экранах */
export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.path}
          className={`nav-item ${pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
          style={{ background: 'none', border: 'none' }}
        >
          <span style={{ fontSize: '18px' }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
