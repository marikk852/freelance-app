import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { HomeIcon, LiveIcon, JobsIcon, ProfileIcon } from './PixelNavIcons';

const NAV_ITEMS = [
  { path: '/',        label: 'HOME',    Icon: HomeIcon    },
  { path: '/live',    label: 'LIVE',    Icon: LiveIcon    },
  { path: '/jobs',    label: 'JOBS',    Icon: JobsIcon    },
  { path: '/profile', label: 'PROFILE', Icon: ProfileIcon },
];

// Icon size: +15% over previous 20px → 23px
const ICON_SIZE = 23;

export function BottomNav() {
  const navigate        = useNavigate();
  const { pathname }    = useLocation();
  const { tg }          = useTelegram();
  const [spinning, setSpin] = useState<string | null>(null);

  const handleNav = (path: string) => {
    tg?.HapticFeedback?.impactOccurred('light');
    setSpin(path);
    navigate(path);
  };

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ path, label, Icon }) => {
        const active = pathname === path || (path !== '/' && pathname.startsWith(path));
        const isSpinning = spinning === path;

        return (
          <button
            key={path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => handleNav(path)}
            style={{ background: 'none', border: 'none' }}
          >
            <span
              className={isSpinning ? 'nav-icon-spin' : ''}
              onAnimationEnd={() => setSpin(null)}
              style={{ display: 'block' }}
            >
              <Icon size={ICON_SIZE} />
            </span>
            <span style={{ fontSize: '6px' }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
