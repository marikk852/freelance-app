import { useEffect, useState, useRef } from 'react';
import { PixelScene } from '../components/PixelScene';
import { useCountUp } from '../hooks/useCountUp';
import { livefeed as livefeedApi } from '../utils/api';

// ============================================================
// Screen 07: LIVE DEALS — real-time deal feed
// ============================================================

// ---- Fake event generator ----
const FAKE_TITLES = [
  'Logo Design', 'Bot Development', 'SEO Article', 'Landing Page',
  'Video Editing', 'UI/UX Design', 'Copywriting', 'Mobile App',
  'Smart Contract', 'Data Analysis', 'Translation', 'Web Scraping',
  'API Integration', 'NFT Artwork', '3D Modeling', 'Voice Over',
  'Game Assets', 'WordPress Site', 'Whitepaper', 'Pitch Deck',
];
const FAKE_TYPES  = ['completed', 'frozen', 'new', 'completed', 'completed', 'frozen'];
const FAKE_CURR   = ['USDT', 'TON', 'USDT', 'USDT', 'TON'];
const FAKE_AMTS   = [45, 80, 120, 150, 200, 250, 300, 350, 500, 60, 90, 180];

let _fakeId = 1000;
function makeFakeEvent() {
  const type = FAKE_TYPES[Math.floor(Math.random() * FAKE_TYPES.length)];
  return {
    id      : `fake_${_fakeId++}`,
    title   : FAKE_TITLES[Math.floor(Math.random() * FAKE_TITLES.length)],
    amount  : FAKE_AMTS[Math.floor(Math.random() * FAKE_AMTS.length)],
    currency: FAKE_CURR[Math.floor(Math.random() * FAKE_CURR.length)],
    type,
    time    : 'just now',
    fake    : true,
    entering: true,   // CSS fade-in
    leaving : false,  // CSS fade-out before remove
  };
}

// ---- Type config ----
const TYPE_META: Record<string, { color: string; label: string; border: string }> = {
  completed: { color: '#00ff88', label: '✅ DONE',    border: 'rgba(0,255,136,0.25)'  },
  frozen   : { color: '#0088ff', label: '🔒 FROZEN',  border: 'rgba(0,136,255,0.25)'  },
  new      : { color: '#ff8800', label: '⚔ NEW',      border: 'rgba(255,136,0,0.25)'  },
  disputed : { color: '#ff4466', label: '⚖ DISPUTE',  border: 'rgba(255,68,102,0.25)' },
};

const FILTERS = ['ALL', 'DONE', 'ACTIVE', 'DISPUTES'];

interface FeedEvent {
  id       : string | number;
  title    : string;
  amount   : number;
  currency : string;
  type     : string;
  time     : string | Date;
  fake?    : boolean;
  entering?: boolean;
  leaving? : boolean;
}

interface Stats {
  completed: number;
  volume   : number;
  active   : number;
  disputes : number;
}

function relativeTime(date: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)           return `${diff}s ago`;
  if (diff < 3600)         return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)        return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function LiveDeals() {
  const [filter,     setFilter]     = useState('ALL');
  const [realEvents, setRealEvents] = useState<FeedEvent[]>([]);
  const [fakeEvents, setFakeEvents] = useState<FeedEvent[]>([]);
  const [stats,      setStats]      = useState<Stats>({ completed: 0, volume: 0, active: 0, disputes: 0 });
  const [loaded,     setLoaded]     = useState(false);
  const fakeTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const countCompleted = useCountUp(stats.completed, 1200);
  const countVolume    = useCountUp(Math.round(stats.volume), 1600);

  // ---- Load real data ----
  async function loadFeed() {
    try {
      const res = await livefeedApi.get();
      setStats(res.data.stats);
      setRealEvents(
        (res.data.events as any[]).map(e => ({
          ...e,
          time: relativeTime(e.time),
        }))
      );
      setLoaded(true);
    } catch {
      setLoaded(true); // show fakes even if real fails
    }
  }

  useEffect(() => {
    loadFeed();
    // Poll every 30s for fresh real data
    pollTimerRef.current = setInterval(loadFeed, 30_000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, []);

  // ---- Fake event scheduler ----
  useEffect(() => {
    function scheduleNext() {
      const delay = 8000 + Math.random() * 12000; // 8-20s
      fakeTimerRef.current = setTimeout(() => {
        const ev = makeFakeEvent();

        // Add with entering animation
        setFakeEvents(prev => [ev, ...prev].slice(0, 6)); // max 6 fakes

        // After 0.4s remove entering flag
        setTimeout(() => {
          setFakeEvents(prev => prev.map(e => e.id === ev.id ? { ...e, entering: false } : e));
        }, 400);

        // Start leaving animation after 18-30s
        const lifespan = 18000 + Math.random() * 12000;
        setTimeout(() => {
          setFakeEvents(prev => prev.map(e => e.id === ev.id ? { ...e, leaving: true } : e));
          // Remove after animation
          setTimeout(() => {
            setFakeEvents(prev => prev.filter(e => e.id !== ev.id));
          }, 500);
        }, lifespan);

        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => { if (fakeTimerRef.current) clearTimeout(fakeTimerRef.current); };
  }, []);

  // ---- Combine + filter ----
  const allEvents: FeedEvent[] = [
    ...fakeEvents,
    ...realEvents,
  ];

  const filtered =
    filter === 'ALL'      ? allEvents :
    filter === 'DONE'     ? allEvents.filter(e => e.type === 'completed') :
    filter === 'ACTIVE'   ? allEvents.filter(e => e.type === 'frozen' || e.type === 'new') :
    allEvents.filter(e => e.type === 'disputed');

  return (
    <div className="page fade-in">
      <PixelScene scene="live_deals" width={252} height={56} />

      {/* HUD */}
      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div className="logo" style={{ color: '#00ff88' }}>
          <span style={{ animation: 'glow-pulse-green 1s infinite', display: 'inline-block' }}>●</span>
          {' '}LIVE FEED
        </div>
        <div style={{ textAlign: 'center', fontSize: '7px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
          Deals in real time
        </div>
      </div>

      {/* Stats */}
      <div className="stats card-stagger-2">
        <div className="stat gl-sm" style={{ borderColor: 'rgba(0,255,136,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#00ff88' }}>{countCompleted}</span>
          <span className="stat-l">DEALS</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(255,170,0,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#ffaa00', fontSize: '10px' }}>${countVolume}</span>
          <span className="stat-l">VOLUME</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(0,136,255,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#0088ff', fontSize: '10px' }}>
            {stats.active + fakeEvents.filter(e => e.type === 'frozen' || e.type === 'new').length}
          </span>
          <span className="stat-l">ACTIVE</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(255,68,102,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#ff4466', fontSize: '10px' }}>
            {stats.disputes}
          </span>
          <span className="stat-l">DISPUTES</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-row card-stagger-3">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`fb ${filter === f ? 'fb-on' : 'fb-off'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Feed */}
      {!loaded ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '7px', color: 'rgba(255,255,255,0.25)' }}>
          LOADING...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '7px', color: 'rgba(255,255,255,0.25)' }}>
          NO EVENTS
        </div>
      ) : (
        filtered.map((e, i) => {
          const meta = TYPE_META[e.type] || TYPE_META.new;
          return (
            <div
              key={e.id}
              className="dc gl fade-in"
              style={{
                borderColor     : meta.border,
                opacity         : e.leaving ? 0 : 1,
                transform       : e.entering ? 'translateY(-12px) scale(0.97)' : e.leaving ? 'translateY(-8px) scale(0.96)' : 'translateY(0) scale(1)',
                transition      : e.entering ? 'none' : 'opacity 0.45s ease, transform 0.45s ease',
                animationDelay  : `${i * 0.05}s`,
                position        : 'relative',
              }}
            >
              <div className="pxgrid" /><div className="sh" />

              {/* NEW badge for fake events just appeared */}
              {e.fake && !e.entering && !e.leaving && (
                <div style={{
                  position: 'absolute', top: '8px', right: '10px',
                  fontSize: '5px', color: '#00ff88',
                  fontFamily: '"Press Start 2P", monospace',
                  animation: 'glow-pulse-green 1.5s infinite',
                }}>● LIVE</div>
              )}

              <div className="dc-top">
                <div className="dc-title" style={{ color: '#fff' }}>{e.title.toUpperCase()}</div>
                <div className="dc-amt" style={{ color: meta.color }}>
                  <span className="pcoin" style={{
                    background: meta.color,
                    borderColor: meta.color,
                    opacity: 0.8,
                  }} />
                  ${e.amount} {e.currency}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span className="badge gl-pill" style={{
                  color      : meta.color,
                  border     : `1px solid ${meta.border}`,
                  background : `${meta.border.replace('0.25', '0.08')}`,
                  fontSize   : '6px',
                }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)' }}>
                  {typeof e.time === 'string' ? e.time : relativeTime(e.time)}
                </span>
              </div>
            </div>
          );
        })
      )}

      <div className="div" />
    </div>
  );
}
