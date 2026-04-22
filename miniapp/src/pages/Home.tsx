import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { CoinBurst } from '../components/CoinBurst';
import { useTelegram } from '../hooks/useTelegram';
import { useCountUp } from '../hooks/useCountUp';
import { users } from '../utils/api';
import dealsImg      from '../assets/icons/deals.png';
import newdealImg    from '../assets/icons/newdeal.png';
import liveImg       from '../assets/icons/live.png';
import jobsImg       from '../assets/icons/jobs.png';
import freelancerImg from '../assets/icons/freelancers.png';

// ============================================================
// Screen 01: HOME — main screen with navigation cards
// ============================================================

function NavCard({
  icon, title, subtitle, accent, onClick, stagger,
}: {
  icon: React.ReactNode; title: string; subtitle: string;
  accent: string; onClick: () => void; stagger: number;
}) {
  return (
    <div
      className={`gl card-stagger-${stagger}`}
      onClick={onClick}
      style={{
        flex: '1 1 calc(50% - 6px)',
        minWidth: 0,
        cursor: 'pointer',
        borderColor: `${accent}44`,
        background: `linear-gradient(135deg, rgba(0,0,0,0.6) 0%, ${accent}0d 100%)`,
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="pxgrid" /><div className="sh" />
      {/* Glow blob */}
      <div style={{
        position: 'absolute', bottom: '-18px', right: '-18px',
        width: '80px', height: '80px', borderRadius: '50%',
        background: accent, opacity: 0.1, filter: 'blur(22px)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 2, lineHeight: 0 }}>{icon}</div>
      <div style={{
        fontSize: '8px', color: accent, fontFamily: '"Press Start 2P", monospace',
        position: 'relative', zIndex: 2, lineHeight: 1.4,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 500,
        color: 'rgba(255,255,255,0.4)',
        position: 'relative', zIndex: 2, lineHeight: 1.4,
      }}>
        {subtitle}
      </div>
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const { user, tg } = useTelegram();
  const [profile,      setProfile]      = useState<any>(null);
  const [activeCount,  setActiveCount]  = useState(0);
  const [burst,        setBurst]        = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, dealsRes] = await Promise.all([
          users.me(),
          users.myDeals(),
        ]);
        setProfile(meRes.data);
        const d = dealsRes.data;
        const all = [...(d.as_client || []), ...(d.as_freelancer || [])];
        setActiveCount(all.filter((x: any) => !['completed','refunded','cancelled'].includes(x.status)).length);
      } catch { /* guest */ }
    })();
  }, []);

  const xp    = profile?.xp ?? 0;
  const xpMax = 1000;
  const xpPct = Math.min(100, Math.round((xp / xpMax) * 100));

  const countDeals  = useCountUp(profile?.deals_completed ?? 0);
  const countCoins  = useCountUp(profile?.safe_coins ?? 0, 1500);
  const countStreak = useCountUp(profile?.streak_days ?? 0, 800);

  const go = (path: string) => {
    tg?.HapticFeedback?.impactOccurred('medium');
    navigate(path);
  };

  return (
    <div className="page fade-in">
      <CoinBurst trigger={burst} originX={50} originY={40} />

      {/* HUD */}
      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div className="logo">SAFEDEAL</div>
        <div className="gl-pill lvl" style={{ padding: '3px 8px' }}>
          LVL {profile?.level ?? 1}
        </div>
        <div className="coins" onClick={() => setBurst(b => !b)} style={{ cursor: 'pointer' }}>
          <span className="pcoin" style={{ background: '#ffaa00', borderColor: '#ff8800' }} />
          {countCoins.toLocaleString()}
        </div>
      </div>

      {/* XP Bar */}
      <div className="gl xp-w card-stagger-2">
        <div className="pxgrid" />
        <div className="xp-top">
          <span className="xp-lbl" style={{ color: '#ffaa00' }}>XP</span>
          <span className="xp-lbl">{xp}/{xpMax}</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{
            background: 'linear-gradient(90deg,#ffaa00,#ff6600)',
            width: `${xpPct}%`,
            transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)',
          }} />
          <div className="xp-shine" />
        </div>
      </div>

      {/* Pixel Scene */}
      <PixelScene scene="home" width={252} height={56} />

      {/* Stats row */}
      <div className="stats card-stagger-3">
        <div className="stat gl-sm" style={{ borderColor: 'rgba(0,136,255,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#0088ff' }}>{countDeals}</span>
          <span className="stat-l">DONE</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(0,255,136,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#00ff88' }}>{activeCount}</span>
          <span className="stat-l">ACTIVE</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(255,170,0,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#ffaa00' }}>{profile?.rating > 0 ? profile.rating : '—'}</span>
          <span className="stat-l">RANK</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(170,0,255,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#cc44ff', fontSize: '11px' }}>🔥{countStreak}</span>
          <span className="stat-l">STREAK</span>
        </div>
      </div>

      {/* Navigation cards 2x2 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
        <NavCard
          icon={<img src={dealsImg} width={48} height={48} style={{ imageRendering: 'pixelated' }} />}
          title="MY DEALS"
          subtitle={activeCount > 0 ? `${activeCount} active` : 'all quests'}
          accent="#00ff88"
          onClick={() => go('/my-deals')}
          stagger={4}
        />
        <NavCard
          icon={<img src={newdealImg} width={48} height={48} style={{ imageRendering: 'pixelated' }} />}
          title="NEW DEAL"
          subtitle="create quest"
          accent="#ffaa00"
          onClick={() => go('/new-deal')}
          stagger={4}
        />
        <NavCard
          icon={<img src={liveImg} width={48} height={48} style={{ imageRendering: 'pixelated' }} />}
          title="LIVE FEED"
          subtitle="deals on air"
          accent="#0088ff"
          onClick={() => go('/live')}
          stagger={5}
        />
        <NavCard
          icon={<img src={jobsImg} width={48} height={48} style={{ imageRendering: 'pixelated' }} />}
          title="JOB BOARD"
          subtitle="find a job"
          accent="#cc44ff"
          onClick={() => go('/jobs')}
          stagger={5}
        />
        <NavCard
          icon={<img src={freelancerImg} width={48} height={48} style={{ imageRendering: 'pixelated' }} />}
          title="FREELANCERS"
          subtitle="find a pro"
          accent="#0088ff"
          onClick={() => go('/freelancers')}
          stagger={5}
        />
      </div>
    </div>
  );
}
