import React, { useEffect, useState, useRef } from 'react';
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

// ============================================================
// RatingBlock — XP bar with title + bottom sheet
// ============================================================
function RatingBlock({ xp, xpMax, xpPct, onNavigate }: {
  xp: number; xpMax: number; xpPct: number; onNavigate: (path: string) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on backdrop tap
  const closeSheet = () => setSheetOpen(false);

  const earnItems = [
    { icon: '✅', title: 'Complete 3 deals', desc: 'Successfully close 3 deals on SafeDeal', crystals: null, action: () => onNavigate('/board') },
    { icon: '📅', title: 'Daily login',      desc: '+10 crystals every day you open the app', crystals: 10,   action: null },
    { icon: '🎯', title: 'Complete quests',  desc: 'Finish tasks in the Quests section',       crystals: null, action: () => { closeSheet(); onNavigate('/quests'); } },
    { icon: '👥', title: 'Refer friends',    desc: '300 crystals for 3 referrals · 10,000 for 20 active', crystals: null, action: () => { closeSheet(); onNavigate('/profile'); } },
  ];

  return (
    <>
      {/* Rating card */}
      <div className="gl card-stagger-2" style={{ position: 'relative', padding: '14px 14px 12px', marginBottom: '4px' }}>
        <div className="pxgrid" />
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div>
            <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: '#ffaa00', lineHeight: 1.4 }}>
              RATING
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '3px', lineHeight: 1.3 }}>
              Level up to reach the top freelancers
            </div>
          </div>
          {/* Chevron button */}
          <button
            onClick={() => setSheetOpen(true)}
            style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 4l4 4 4-4"/>
            </svg>
          </button>
        </div>
        {/* XP bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#ffaa00' }}>XP</span>
          <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: 'rgba(255,255,255,0.5)' }}>{xp}/{xpMax}</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ background: 'linear-gradient(90deg,#ffaa00,#ff6600)', width: `${xpPct}%`, transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)' }} />
          <div className="xp-shine" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: '#ffaa00' }}>{xpPct}% to next level</span>
        </div>
      </div>

      {/* Bottom sheet backdrop */}
      {sheetOpen && (
        <div
          onClick={closeSheet}
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          zIndex: 9991,
          height: '90%',
          background: '#0a0a0a',
          borderRadius: '20px 20px 0 0',
          border: '1px solid rgba(255,255,255,0.1)',
          transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Sheet content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
              Earn Safe Crystals
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Crystals boost your rating and unlock<br/>top positions on SafeDeal
            </div>
          </div>

          {/* Earn ways */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ padding: '14px 16px 6px' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#00ff88' }}>
                How to earn
              </span>
            </div>
            {earnItems.map((item, i) => (
              <div
                key={i}
                onClick={item.action || undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 16px',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  cursor: item.action ? 'pointer' : 'default',
                }}
              >
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                    {item.title}
                    {item.crystals && (
                      <span style={{ color: '#00ff88', marginLeft: '6px' }}>+{item.crystals}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                    {item.desc}
                  </div>
                </div>
                {item.action && (
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 1l6 6-6 6"/>
                  </svg>
                )}
              </div>
            ))}
          </div>

          {/* Referral block */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ padding: '14px 16px 6px' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#00ff88' }}>
                Referral Boost
              </span>
            </div>
            <div
              onClick={() => { closeSheet(); onNavigate('/profile'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '20px' }}>👥</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                  Invite friends
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                  300 crystals for 3 friends · 10,000 for 20 active users
                </div>
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l6 6-6 6"/>
              </svg>
            </div>
          </div>

          {/* Subscription block */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ padding: '14px 16px 6px' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#cc44ff' }}>
                Subscription
              </span>
            </div>
            {[
              { key: 'basic', name: 'Basic', price: '$5.99/mo', crystals: 15000, desc: 'Verified badge · Profile boost · 15,000 crystals/month', color: '#0088ff' },
              { key: 'pro',   name: 'Pro',   price: '$15.99/mo', crystals: 20000, desc: 'Pro badge · Profile + listing boost · 20,000 crystals/month', color: '#cc44ff' },
            ].map((plan, i) => (
              <div
                key={plan.key}
                onClick={() => { closeSheet(); onNavigate(`/subscription?plan=${plan.key}`); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 16px',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: `${plan.color}22`, border: `1px solid ${plan.color}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px',
                }}>
                  {plan.key === 'basic' ? '✦' : '✦✦'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#fff' }}>{plan.name}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: plan.color, fontWeight: 600 }}>{plan.price}</span>
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                    {plan.desc}
                  </div>
                </div>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 1l6 6-6 6"/>
                </svg>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <button
            onClick={() => { closeSheet(); onNavigate('/board'); }}
            style={{
              width: '100%', padding: '16px',
              background: '#fff', color: '#000',
              border: 'none', borderRadius: '14px',
              fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700,
              cursor: 'pointer', marginBottom: '8px',
            }}
          >
            Start working
          </button>
        </div>
      </div>
    </>
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
  const countCoins  = useCountUp(profile?.safe_crystals ?? 0, 1500);
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
        {/* Avatar + total balance (synced with mobile HUD) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginRight: '20px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%', background: avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontSize: '12px', fontWeight: 700, color: '#fff', fontFamily: 'Inter, sans-serif',
            boxShadow: `0 0 12px ${avatarColor}55`,
          }}>{initials}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '9px', color: 'var(--t-3)', fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>TOTAL BALANCE</span>
            <span style={{ fontSize: '16px', color: 'var(--t-1)', fontFamily: 'Inter, sans-serif', fontWeight: 700, lineHeight: 1 }}>${totalBalanceUsd.toFixed(2)}</span>
          </div>
        </div>
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
              }}>TOTAL BALANCE</span>
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
            {/* Safe Crystals pill */}
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
                {(profile?.safe_crystals ?? 0).toLocaleString()}
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
        {/* ── Rating block with bottom sheet trigger ── */}
        <RatingBlock xp={xp} xpMax={xpMax} xpPct={xpPct} onNavigate={go} />
        {/* Hero scene — native canvas scaled to full width (crisp pixel art) */}
        <div className="gl home-scene-card card-stagger-3">
          <div className="pxgrid" /><div className="sh" />
          <PixelScene scene="home" />
        </div>
      </div>

      {/* ── Desktop hero grid: scene + 4 stat cards ── */}
      <div className="page-inner">
        <div className="home-hero-grid desktop-only">
          <div className="gl home-hero-scene">
            <div className="pxgrid" /><div className="sh" />
            <PixelScene scene="home" />
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
          <NavCard icon={<JobBoardIcon size={64} />}   title="JOB BOARD"   subtitle="find a job"    accent="#cc44ff" onClick={() => go('/board?tab=jobs')}        stagger={5} />
          <NavCard icon={<FreelancerIcon size={64} />} title="FREELANCERS" subtitle="find a pro"    accent="#0088ff" onClick={() => go('/board?tab=freelancers')} stagger={5} />
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
