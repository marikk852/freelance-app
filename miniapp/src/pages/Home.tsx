import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { CoinBurst } from '../components/CoinBurst';
import { useTelegram } from '../hooks/useTelegram';
import { useCountUp } from '../hooks/useCountUp';
import { users, notifications as notificationsApi, livefeed as livefeedApi } from '../utils/api';
import { FlameIcon } from '../components/FlameIcon';
import { DealsIcon, NewDealIcon, LiveFeedIcon, JobBoardIcon, FreelancerIcon } from '../components/HomeNavIcons';

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
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [activeDeals,  setActiveDeals]  = useState<any[]>([]);
  const [liveItems,    setLiveItems]    = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, dealsRes, notifRes, liveRes] = await Promise.all([
          users.me(),
          users.myDeals(),
          notificationsApi.unreadCount().catch(() => ({ data: { count: 0 } })),
          livefeedApi.get().catch(() => ({ data: [] })),
        ]);
        setProfile(meRes.data);
        const d = dealsRes.data;
        const all = [...(d.as_client || []), ...(d.as_freelancer || [])];
        const active = all.filter((x: any) => !['completed','refunded','cancelled'].includes(x.status));
        setActiveCount(active.length);
        setActiveDeals(active.slice(0, 3));
        setUnreadCount(notifRes.data.count ?? 0);
        setLiveItems((liveRes.data || []).slice(0, 4));
      } catch { /* guest */ }
    })();
  }, []);

  const xp    = profile?.xp ?? 0;
  const xpMax = 1000;
  const xpPct = Math.min(100, Math.round((xp / xpMax) * 100));

  const countDeals  = useCountUp(profile?.deals_completed ?? 0);
  const countCoins  = useCountUp(profile?.safe_coins ?? 0, 1500);
  const countStreak = useCountUp(profile?.streak_days ?? 0, 800);

  // Общий баланс = сумма amount_usd активных сделок
  const totalBalanceUsd = activeDeals.reduce((s: number, d: any) => s + (Number(d.amount_usd) || 0), 0);

  // Инициалы для аватарки
  const initials = (() => {
    const f = profile?.first_name || user?.first_name || '';
    const l = profile?.last_name  || user?.last_name  || '';
    return ((f[0] || '') + (l[0] || '')).toUpperCase() || (profile?.username?.[0] || '?').toUpperCase();
  })();

  // Цвет аватарки на основе telegram_id
  const avatarColors = ['#0088ff','#00cc88','#ff6644','#aa44ff','#ffaa00','#ff4488'];
  const avatarColor  = avatarColors[(Number(profile?.telegram_id || 0)) % avatarColors.length];

  const go = (path: string) => {
    tg?.HapticFeedback?.impactOccurred('medium');
    navigate(path);
  };

  const statusColor: Record<string, string> = {
    awaiting_payment: '#ff8800', in_progress: '#00ff88',
    under_review: '#cc44ff', disputed: '#ff4466', signed: '#0088ff',
  };

  return (
    <div className="page fade-in">
      <CoinBurst trigger={burst} originX={50} originY={40} />

      {/* ── Desktop topbar (hidden on mobile) ── */}
      <div className="desktop-topbar desktop-only">
        <div className="desktop-topbar-title">DASHBOARD / <span>HOME</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="desktop-xp-label">XP {xp}/{xpMax}</span>
          <div className="desktop-xp-track">
            <div className="desktop-xp-fill" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="desktop-xp-lvl">LVL {profile?.level ?? 1}</span>
        </div>
        <div className="desktop-bell" onClick={() => go('/notifications')} style={{ position: 'relative' }}>
          <span>🔔</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-6px',
              minWidth: '14px', height: '14px',
              background: '#ff4466', borderRadius: '7px', fontSize: '7px', color: '#fff',
              fontFamily: '"Press Start 2P", monospace',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 2px', boxShadow: '0 0 6px rgba(255,68,102,0.7)', lineHeight: 1,
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div onClick={() => setBurst(b => !b)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="pcoin" style={{ background: '#ffaa00', borderColor: '#ff8800', display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '1.5px solid' }} />
          <span style={{ fontSize: '6px', color: '#ffaa00', fontFamily: '"Press Start 2P", monospace' }}>{countCoins.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Mobile-only: HUD + XP + Scene ── */}
      <div className="mobile-only">
        {/* ── New HUD: avatar + balance | coins + bell ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 4px 8px', gap: '8px',
        }}>
          {/* Left: avatar + balance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Avatar circle */}
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontSize: '13px', fontWeight: 700, color: '#fff',
              fontFamily: 'Inter, sans-serif',
              boxShadow: `0 0 12px ${avatarColor}55`,
            }}>
              {initials}
            </div>
            {/* Balance info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{
                fontSize: '11px', color: 'rgba(255,255,255,0.45)',
                fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: 1,
              }}>Общий баланс</span>
              <span style={{
                fontSize: '17px', color: '#fff',
                fontFamily: 'Inter, sans-serif', fontWeight: 600, lineHeight: 1,
              }}>
                ${totalBalanceUsd.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Right: coins pill + bell */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* SafeCoins pill */}
            <div
              onClick={() => setBurst(b => !b)}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px', padding: '6px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              <span style={{ fontSize: '13px' }}>🪙</span>
              <span style={{
                fontSize: '13px', fontWeight: 600, color: '#fff',
                fontFamily: 'Inter, sans-serif',
              }}>
                {(profile?.safe_coins ?? 0).toLocaleString()}
              </span>
              <span style={{
                fontSize: '11px', color: 'rgba(255,255,255,0.45)',
                fontFamily: 'Inter, sans-serif',
              }}>SC</span>
            </div>
            {/* Bell */}
            <div onClick={() => go('/notifications')} style={{ position: 'relative', cursor: 'pointer', lineHeight: 0 }}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-3px', right: '-5px',
                  minWidth: '14px', height: '14px',
                  background: '#ff4466', borderRadius: '7px', fontSize: '7px', color: '#fff',
                  fontFamily: '"Press Start 2P", monospace',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 2px', boxShadow: '0 0 6px rgba(255,68,102,0.7)', lineHeight: 1,
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="gl xp-w card-stagger-2">
          <div className="pxgrid" />
          <div className="xp-top">
            <span className="xp-lbl" style={{ color: '#ffaa00' }}>XP</span>
            <span className="xp-lbl">{xp}/{xpMax}</span>
          </div>
          <div className="xp-track">
            <div className="xp-fill" style={{ background: 'linear-gradient(90deg,#ffaa00,#ff6600)', width: `${xpPct}%`, transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)' }} />
            <div className="xp-shine" />
          </div>
        </div>
        <PixelScene scene="home" width={252} height={56} />
      </div>

      {/* ── Desktop hero grid: scene + 4 stat cards ── */}
      <div className="page-inner">
        <div className="home-hero-grid desktop-only">
          <div className="gl home-hero-scene">
            <div className="pxgrid" /><div className="sh" />
            <PixelScene scene="home" width={480} height={170} />
          </div>
          <div className="gl home-hero-stat" style={{ borderColor: 'rgba(0,136,255,0.2)' }}>
            <div className="pxgrid" />
            <span className="stat-icon">✅</span>
            <span className="stat-n" style={{ color: '#0088ff' }}>{countDeals}</span>
            <span className="stat-l">DONE</span>
          </div>
          <div className="gl home-hero-stat" style={{ borderColor: 'rgba(0,255,136,0.2)' }}>
            <div className="pxgrid" />
            <span className="stat-icon">⚡</span>
            <span className="stat-n" style={{ color: '#00ff88' }}>{activeCount}</span>
            <span className="stat-l">ACTIVE</span>
          </div>
          <div className="gl home-hero-stat" style={{ borderColor: 'rgba(255,170,0,0.2)' }}>
            <div className="pxgrid" />
            <span className="stat-icon">🏆</span>
            <span className="stat-n" style={{ color: '#ffaa00' }}>{profile?.rating > 0 ? profile.rating : '—'}</span>
            <span className="stat-l">RANK</span>
          </div>
          <div className="gl home-hero-stat" style={{ borderColor: 'rgba(204,68,255,0.2)' }}>
            <div className="pxgrid" />
            <FlameIcon size={22} />
            <span className="stat-n" style={{ color: '#cc44ff' }}>{countStreak}</span>
            <span className="stat-l">STREAK</span>
          </div>
        </div>

        {/* Mobile stats row */}
        <div className="stats card-stagger-3 mobile-only">
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
            <span className="stat-n" style={{ color: '#cc44ff', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <FlameIcon size={18} />{countStreak}
            </span>
            <span className="stat-l">STREAK</span>
          </div>
        </div>

        {/* ── Navigation cards (mobile: 2-col wrap, desktop: 5-col row) ── */}
        <div className="home-action-row card-stagger-4" style={{ marginTop: '4px' }}>
          <NavCard icon={<DealsIcon size={64} />}      title="MY DEALS"    subtitle={activeCount > 0 ? `${activeCount} active` : 'all quests'} accent="#00ff88" onClick={() => go('/my-deals')}    stagger={4} />
          <NavCard icon={<NewDealIcon size={64} />}    title="NEW DEAL"    subtitle="create quest"  accent="#ffaa00" onClick={() => go('/new-deal')}    stagger={4} />
          <NavCard icon={<LiveFeedIcon size={64} />}   title="LIVE FEED"   subtitle="deals on air"  accent="#0088ff" onClick={() => go('/live')}        stagger={5} />
          <NavCard icon={<JobBoardIcon size={64} />}   title="JOB BOARD"   subtitle="find a job"    accent="#cc44ff" onClick={() => go('/jobs')}        stagger={5} />
          <NavCard icon={<FreelancerIcon size={64} />} title="FREELANCERS" subtitle="find a pro"    accent="#0088ff" onClick={() => go('/freelancers')} stagger={5} />
        </div>

        {/* ── Desktop bottom row: active deals + live feed ── */}
        <div className="home-bottom-grid desktop-only">
          {/* Active deals */}
          <div className="gl">
            <div className="pxgrid" />
            <div className="home-list-header">
              <span className="home-list-title">ACTIVE DEALS</span>
              <span className="home-list-badge">{activeCount} deals</span>
            </div>
            {activeDeals.length === 0 ? (
              <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.2)', fontFamily: '"Press Start 2P", monospace', textAlign: 'center', padding: '16px 0' }}>
                No active deals
              </div>
            ) : activeDeals.map((deal: any) => (
              <div key={deal.id} className="home-deal-item" onClick={() => go(`/deal/${deal.id}`)}>
                <div className="home-deal-dot" style={{ background: statusColor[deal.status] || '#888' }} />
                <div className="home-deal-info">
                  <div className="home-deal-name">{deal.title}</div>
                  <div className="home-deal-meta">{deal.status?.replace(/_/g, ' ')}</div>
                </div>
                <div className="home-deal-amt">{deal.crypto_amount ? `${(+deal.crypto_amount).toFixed(2)} TON` : `$${deal.amount_usd}`}</div>
              </div>
            ))}
          </div>

          {/* Live feed */}
          <div className="gl">
            <div className="pxgrid" />
            <div className="home-list-header">
              <span className="home-list-title">LIVE FEED</span>
              <span className="home-list-badge" style={{ borderColor: 'rgba(255,68,102,0.3)', color: '#ff4466' }}>● LIVE</span>
            </div>
            {liveItems.length === 0 ? (
              <>
                {[
                  { emoji: '✅', text: 'Deal completed · NFT Art', time: '2m ago' },
                  { emoji: '🔒', text: 'Escrow locked · Bot Dev', time: '7m ago' },
                  { emoji: '🆕', text: 'New deal · DeFi Landing', time: '14m ago' },
                ].map((item, i) => (
                  <div key={i} className="home-live-item">
                    <span className="home-live-emoji">{item.emoji}</span>
                    <div>
                      <div className="home-live-text">{item.text}</div>
                      <div className="home-live-time">{item.time}</div>
                    </div>
                  </div>
                ))}
              </>
            ) : liveItems.map((item: any, i: number) => (
              <div key={i} className="home-live-item">
                <span className="home-live-emoji">{item.emoji || '📡'}</span>
                <div>
                  <div className="home-live-text">{item.message || item.text}</div>
                  <div className="home-live-time">{item.time_ago || item.created_at?.slice(11,16)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
