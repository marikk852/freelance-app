import { useEffect, useState } from 'react';
import { PixelScene } from '../components/PixelScene';
import { GlassCard, StatusPill } from '../components/GlassCard';

// ============================================================
// Экран 07: LIVE DEALS — лента сделок в реальном времени
// ============================================================

// Моковые данные для демонстрации Live ленты
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

const TYPE_META: Record<string, { emoji: string; color: string; label: string }> = {
  completed: { emoji: '✅', color: '#00FF88', label: 'Завершена' },
  frozen   : { emoji: '🔒', color: '#0088FF', label: 'Заморожено' },
  new      : { emoji: '⚔️', color: '#FF8800', label: 'Новая' },
  disputed : { emoji: '⚖️', color: '#FF4466', label: 'Спор' },
};

const FILTERS = ['Все', 'Завершены', 'Активные', 'Споры'];

export function LiveDeals() {
  const [filter,  setFilter]  = useState('Все');
  const [events,  setEvents]  = useState(MOCK_EVENTS);
  const [counter, setCounter] = useState({ completed: 0, volume: 0 });

  // Имитируем новые события
  useEffect(() => {
    const total   = MOCK_EVENTS.filter(e => e.type === 'completed').length;
    const volume  = MOCK_EVENTS.filter(e => e.type === 'completed').reduce((s, e) => s + e.amount, 0);
    setCounter({ completed: total, volume });
  }, []);

  const filtered = filter === 'Все'       ? events
    : filter === 'Завершены' ? events.filter(e => e.type === 'completed')
    : filter === 'Активные'  ? events.filter(e => e.type === 'frozen' || e.type === 'new')
    : events.filter(e => e.type === 'disputed');

  return (
    <div className="page fade-in">
      <PixelScene scene="live_deals" width={320} height={110} />

      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <h1 style={{ fontSize: '11px', color: '#00FF88' }}>
          <span style={{ animation: 'pulse 1s infinite', display: 'inline-block' }}>●</span> LIVE
        </h1>
        <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
          Сделки в реальном времени
        </p>
      </div>

      {/* Счётчики */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div className="glass" style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', color: '#00FF88' }}>{counter.completed}</div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Сделок сегодня</div>
        </div>
        <div className="glass" style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', color: '#FFAA00' }}>${counter.volume}</div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Объём (USDT)</div>
        </div>
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn ${filter === f ? 'btn-green' : 'btn-ghost'}`}
            style={{ fontSize: '7px', padding: '6px 12px', whiteSpace: 'nowrap' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Лента событий */}
      {filtered.map((e, i) => {
        const meta = TYPE_META[e.type] || TYPE_META.new;
        return (
          <GlassCard key={e.id} style={{ animationDelay: `${i * 0.05}s` }}
            className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>{meta.emoji}</span>
                <div>
                  <div style={{ fontSize: '9px', color: '#fff' }}>{e.title}</div>
                  <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>{e.time}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: meta.color }}>${e.amount}</div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)' }}>{e.currency}</div>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
