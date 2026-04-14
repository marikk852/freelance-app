import { useEffect, useState } from 'react';
import { PixelScene } from '../components/PixelScene';
import { useCountUp } from '../hooks/useCountUp';

// ============================================================
// Экран 07: LIVE DEALS — лента сделок в реальном времени
// ============================================================

const MOCK_EVENTS = [
  { id: 1, type: 'completed', title: 'Дизайн логотипа',    amount: 120, currency: 'USDT', time: '2m ago' },
  { id: 2, type: 'frozen',    title: 'Разработка бота',    amount: 350, currency: 'TON',  time: '5m ago' },
  { id: 3, type: 'completed', title: 'SEO статья',         amount: 45,  currency: 'USDT', time: '8m ago' },
  { id: 4, type: 'new',       title: 'Верстка лендинга',   amount: 200, currency: 'USDT', time: '12m ago' },
  { id: 5, type: 'completed', title: 'Монтаж видео',       amount: 80,  currency: 'USDT', time: '15m ago' },
  { id: 6, type: 'disputed',  title: 'Написание кода',     amount: 500, currency: 'USDT', time: '22m ago' },
  { id: 7, type: 'frozen',    title: 'Иллюстрации',        amount: 150, currency: 'TON',  time: '31m ago' },
  { id: 8, type: 'completed', title: 'Перевод документов', amount: 60,  currency: 'USDT', time: '45m ago' },
];

const TYPE_META: Record<string, { color: string; label: string; border: string }> = {
  completed: { color: '#00ff88', label: '✅ DONE',    border: 'rgba(0,255,136,0.25)'   },
  frozen   : { color: '#0088ff', label: '🔒 FROZEN',  border: 'rgba(0,136,255,0.25)'   },
  new      : { color: '#ff8800', label: '⚔ NEW',      border: 'rgba(255,136,0,0.25)'   },
  disputed : { color: '#ff4466', label: '⚖ DISPUTE',  border: 'rgba(255,68,102,0.25)'  },
};

const FILTERS = ['ВСЕ', 'DONE', 'ACTIVE', 'СПОРЫ'];

export function LiveDeals() {
  const [filter, setFilter] = useState('ВСЕ');
  const [tick,   setTick]   = useState(0);

  const totalCompleted = MOCK_EVENTS.filter(e => e.type === 'completed').length;
  const totalVolume    = MOCK_EVENTS.filter(e => e.type === 'completed').reduce((s, e) => s + e.amount, 0);

  const countCompleted = useCountUp(totalCompleted, 1200);
  const countVolume    = useCountUp(totalVolume, 1600);

  // Simulate live ticker
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const filtered =
    filter === 'ВСЕ'   ? MOCK_EVENTS :
    filter === 'DONE'   ? MOCK_EVENTS.filter(e => e.type === 'completed') :
    filter === 'ACTIVE' ? MOCK_EVENTS.filter(e => e.type === 'frozen' || e.type === 'new') :
    MOCK_EVENTS.filter(e => e.type === 'disputed');

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
          Сделки в реальном времени
        </div>
      </div>

      {/* Счётчики */}
      <div className="stats card-stagger-2">
        <div className="stat gl-sm" style={{ borderColor: 'rgba(0,255,136,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#00ff88' }}>{countCompleted}</span>
          <span className="stat-l">СДЕЛОК</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(255,170,0,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#ffaa00', fontSize: '10px' }}>${countVolume}</span>
          <span className="stat-l">ОБЪЁМ</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(0,136,255,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#0088ff', fontSize: '10px' }}>
            {MOCK_EVENTS.filter(e => e.type === 'frozen' || e.type === 'new').length}
          </span>
          <span className="stat-l">ACTIVE</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(255,68,102,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#ff4466', fontSize: '10px' }}>
            {MOCK_EVENTS.filter(e => e.type === 'disputed').length}
          </span>
          <span className="stat-l">СПОРЫ</span>
        </div>
      </div>

      {/* Фильтры */}
      <div className="filter-row card-stagger-3">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`fb ${filter === f ? 'fb-on' : 'fb-off'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Лента событий */}
      {filtered.map((e, i) => {
        const meta = TYPE_META[e.type] || TYPE_META.new;
        return (
          <div key={e.id}
            className={`dc gl card-stagger-${Math.min(i + 4, 5)} fade-in`}
            style={{ borderColor: meta.border, animationDelay: `${i * 0.06}s` }}>
            <div className="pxgrid" /><div className="sh" />
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
                color: meta.color,
                border: `1px solid ${meta.border}`,
                background: `${meta.border.replace('0.25', '0.08')}`,
                fontSize: '6px',
              }}>
                {meta.label}
              </span>
              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)' }}>{e.time}</span>
            </div>
          </div>
        );
      })}

      <div className="div" />
    </div>
  );
}
