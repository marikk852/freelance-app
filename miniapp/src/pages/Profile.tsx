import { useEffect, useState } from 'react';
import { PixelScene } from '../components/PixelScene';
import { GlassCard, DataRow, Divider } from '../components/GlassCard';
import { users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Экран 08: PROFILE — аватар, статистика, кошелёк, портфолио
// ============================================================

export function Profile() {
  const { user, tg } = useTelegram();
  const [profile,   setProfile]   = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [reviews,   setReviews]   = useState<any[]>([]);
  const [wallet,    setWallet]    = useState('');
  const [tab,       setTab]       = useState<'stats'|'portfolio'|'reviews'>('stats');
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, port, rev] = await Promise.all([
          usersApi.me(),
          user?.id ? usersApi.portfolio(user.id) : Promise.resolve({ data: [] }),
          user?.id ? usersApi.reviews(user.id)   : Promise.resolve({ data: [] }),
        ]);
        setProfile(p.data);
        setPortfolio(port.data);
        setReviews(rev.data);
        setWallet(p.data.ton_wallet_address || '');
      } catch { /* гость */ }
    })();
  }, []);

  const handleSaveWallet = async () => {
    if (!wallet.trim()) return;
    setLoading(true);
    try {
      await usersApi.setWallet(wallet);
      toast.success('Кошелёк сохранён!');
      tg?.HapticFeedback?.notificationOccurred('success');
    } catch { toast.error('Ошибка'); } finally { setLoading(false); }
  };

  const xpToNext  = 200;
  const xpCurrent = profile ? profile.xp % xpToNext : 0;

  return (
    <div className="page fade-in">
      <PixelScene scene="profile" width={320} height={110} />

      {/* Шапка профиля */}
      <div style={{ textAlign: 'center', margin: '12px 0 16px' }}>
        <div style={{ fontSize: '32px' }}>🛡</div>
        <h1 style={{ fontSize: '11px', color: '#fff', marginTop: '6px' }}>
          {user?.first_name || 'Гость'}
        </h1>
        {user?.username && (
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            @{user.username}
          </div>
        )}
        {profile && (
          <span className="pill pill-gold" style={{ marginTop: '8px', display: 'inline-block' }}>
            ⚔️ LVL {profile.level}
          </span>
        )}
      </div>

      {/* XP Bar */}
      {profile && (
        <GlassCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>XP</span>
            <span style={{ fontSize: '8px', color: '#FFAA00' }}>{xpCurrent}/{xpToNext}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(xpCurrent / xpToNext) * 100}%` }} />
          </div>
        </GlassCard>
      )}

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {(['stats','portfolio','reviews'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn btn-full ${tab === t ? 'btn-green' : 'btn-ghost'}`}
            style={{ fontSize: '7px', padding: '8px' }}>
            {t === 'stats' ? '📊' : t === 'portfolio' ? '📁' : '⭐'}
            {' '}{t === 'stats' ? 'СТАТ' : t === 'portfolio' ? 'ПОРТ' : 'ОТЗЫВЫ'}
          </button>
        ))}
      </div>

      {/* Статистика */}
      {tab === 'stats' && profile && (
        <>
          <GlassCard>
            <DataRow label="Сделок завершено" value={String(profile.deals_completed)} color="#00FF88" />
            <DataRow label="Рейтинг"          value={profile.rating > 0 ? `⭐ ${profile.rating}` : 'Нет'} color="#FFAA00" />
            <DataRow label="🔥 Streak"         value={`${profile.streak_days} дней`} />
            <DataRow label="🪙 SafeCoins"       value={String(profile.safe_coins)} color="#CC44FF" />
            <DataRow label="XP всего"          value={String(profile.xp)} color="#0088FF" />
          </GlassCard>

          {/* TON Кошелёк */}
          <GlassCard>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              💎 TON Кошелёк
            </div>
            <input className="input" value={wallet} onChange={e => setWallet(e.target.value)}
              placeholder="UQ..." style={{ marginBottom: '8px' }} />
            <button className="btn btn-blue btn-full" onClick={handleSaveWallet} disabled={loading}>
              {loading ? '⏳' : '💾 СОХРАНИТЬ'}
            </button>
          </GlassCard>
        </>
      )}

      {/* Портфолио */}
      {tab === 'portfolio' && (
        portfolio.length === 0 ? (
          <GlassCard style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '24px' }}>📁</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
              Портфолио пусто.<br/>Завершай сделки!
            </div>
          </GlassCard>
        ) : (
          portfolio.map(p => (
            <GlassCard key={p.id}>
              <div style={{ fontSize: '9px', color: '#fff' }}>{p.title}</div>
              <div style={{ fontSize: '8px', color: '#FFAA00', marginTop: '4px' }}>
                ${p.amount_usd} {p.currency}
              </div>
              {p.tags?.map((tag: string) => (
                <span key={tag} className="pill pill-purple" style={{ marginRight: '4px', marginTop: '6px', display: 'inline-block' }}>
                  {tag}
                </span>
              ))}
            </GlassCard>
          ))
        )
      )}

      {/* Отзывы */}
      {tab === 'reviews' && (
        reviews.length === 0 ? (
          <GlassCard style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '24px' }}>⭐</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
              Отзывов пока нет
            </div>
          </GlassCard>
        ) : (
          reviews.map((r, i) => (
            <GlassCard key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>
                  @{r.reviewer_username}
                </span>
                <span style={{ color: '#FFAA00', fontSize: '9px' }}>{'⭐'.repeat(r.rating)}</span>
              </div>
              {r.comment && <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.6)' }}>{r.comment}</div>}
            </GlassCard>
          ))
        )
      )}
    </div>
  );
}
