import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { GlassCard, StatusPill, DataRow } from '../components/GlassCard';
import { useTelegram } from '../hooks/useTelegram';
import { users, contracts } from '../utils/api';

// ============================================================
// Экран 01: HOME — главная, активные сделки, статистика
// ============================================================

export function Home() {
  const navigate = useNavigate();
  const { user }  = useTelegram();
  const [profile, setProfile] = useState<any>(null);
  const [deals,   setDeals]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes] = await Promise.all([users.me()]);
        setProfile(profileRes.data);
      } catch { /* гость */ }
      setLoading(false);
    })();
  }, []);

  const xpToNext  = 200;
  const xpProgress = profile ? (profile.xp % xpToNext) / xpToNext * 100 : 0;

  return (
    <div className="page fade-in">
      <PixelScene scene="home" width={320} height={110} />

      {/* Заголовок */}
      <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
        <h1 className="glow-green" style={{ fontSize: '14px', letterSpacing: '1px' }}>
          SAFEDEAL
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '8px', marginTop: '6px' }}>
          Безопасные сделки на TON
        </p>
      </div>

      {/* Профиль / XP */}
      {profile && (
        <GlassCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#fff' }}>
                {user?.first_name || profile.first_name}
              </div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>
                {profile.username ? `@${profile.username}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="pill pill-gold">LVL {profile.level}</span>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>
                🔥 {profile.streak_days} streak
              </div>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${xpProgress}%` }} />
          </div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: '4px' }}>
            {profile.xp % xpToNext} / {xpToNext} XP
          </div>
        </GlassCard>
      )}

      {/* Статистика */}
      {profile && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {[
            { label: 'Сделок', value: profile.deals_completed, color: '#00FF88' },
            { label: 'Рейтинг', value: profile.rating > 0 ? `⭐${profile.rating}` : '—', color: '#FFAA00' },
            { label: 'SafeCoins', value: `🪙${profile.safe_coins}`, color: '#CC44FF' },
          ].map(s => (
            <div key={s.label} className="glass" style={{ padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Активные сделки */}
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
          ⚔️ Активные квесты
        </h2>
        {deals.length === 0 ? (
          <GlassCard style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏰</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>
              Квестов пока нет
            </div>
          </GlassCard>
        ) : (
          deals.map(d => (
            <GlassCard key={d.id} onClick={() => navigate(`/deal/${d.contract_id}`)}
              style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '9px' }}>{d.contract_title}</span>
                <StatusPill status={d.contract_status} />
              </div>
              <div style={{ fontSize: '8px', color: '#FFAA00', marginTop: '6px' }}>
                ${d.amount_usd} {d.currency}
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {/* Кнопка нового квеста */}
      <button className="btn btn-green btn-full" onClick={() => navigate('/new-deal')}>
        ⚔️ НОВЫЙ КВЕСТ
      </button>
    </div>
  );
}
