import { useEffect, useState } from 'react';
import { PixelScene } from '../components/PixelScene';
import { DataRow } from '../components/GlassCard';
import { users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import { useCountUp } from '../hooks/useCountUp';
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
    tg?.HapticFeedback?.impactOccurred('medium');
    setLoading(true);
    try {
      await usersApi.setWallet(wallet);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Кошелёк сохранён!');
    } catch { toast.error('Ошибка'); } finally { setLoading(false); }
  };

  const xpMax     = 1000;
  const xp        = profile?.xp ?? 0;
  const xpPct     = Math.min(100, Math.round((xp / xpMax) * 100));

  const countDeals  = useCountUp(profile?.deals_completed ?? 0);
  const countCoins  = useCountUp(profile?.safe_coins ?? 0, 1500);
  const countStreak = useCountUp(profile?.streak_days ?? 0, 800);

  const switchTab = (t: typeof tab) => {
    tg?.HapticFeedback?.selectionChanged();
    setTab(t);
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="profile" width={252} height={56} />

      {/* Шапка профиля */}
      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '6px' }}>🛡</div>
          <div className="logo" style={{ fontSize: '9px' }}>
            {user?.first_name?.toUpperCase() || 'GUEST'}
          </div>
          {user?.username && (
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
              @{user.username}
            </div>
          )}
          {profile && (
            <div className="gl-pill lvl" style={{ padding: '3px 10px', margin: '8px auto 0', display: 'inline-block' }}>
              ⚔ LVL {profile.level}
            </div>
          )}
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

      {/* Mini stats */}
      <div className="stats card-stagger-3">
        <div className="stat gl-sm" style={{ borderColor: 'rgba(0,255,136,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#00ff88' }}>{countDeals}</span>
          <span className="stat-l">DONE</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(255,170,0,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#ffaa00', fontSize: '11px' }}>{countCoins.toLocaleString()}</span>
          <span className="stat-l">COINS</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(170,0,255,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#cc44ff' }}>
            {profile?.rating > 0 ? `⭐${profile.rating}` : '—'}
          </span>
          <span className="stat-l">RANK</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor: 'rgba(255,136,0,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color: '#ff8800', fontSize: '11px' }}>🔥{countStreak}</span>
          <span className="stat-l">STREAK</span>
        </div>
      </div>

      {/* Вкладки */}
      <div className="filter-row card-stagger-4">
        {(['stats','portfolio','reviews'] as const).map(t => (
          <button key={t} onClick={() => switchTab(t)}
            className={`fb ${tab === t ? 'fb-on' : 'fb-off'}`}>
            {t === 'stats' ? '📊 СТАТ' : t === 'portfolio' ? '📁 ПОРТ' : '⭐ ОТЗЫВЫ'}
          </button>
        ))}
      </div>

      {/* Статистика */}
      {tab === 'stats' && profile && (
        <>
          <div className="gl card-stagger-4">
            <div className="pxgrid" /><div className="sh" />
            <DataRow label="Сделок завершено" value={String(profile.deals_completed)} color="#00ff88" />
            <DataRow label="Рейтинг"          value={profile.rating > 0 ? `⭐ ${profile.rating}` : 'Нет'} color="#ffaa00" />
            <DataRow label="🔥 Streak"         value={`${profile.streak_days} дней`} />
            <DataRow label="🪙 SafeCoins"       value={String(profile.safe_coins)} color="#cc44ff" />
            <DataRow label="XP всего"          value={String(profile.xp)} color="#0088ff" />
          </div>

          {/* TON Кошелёк */}
          <div className="gl card-stagger-5">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
              💎 TON КОШЕЛЁК
            </div>
            <input className="input" value={wallet} onChange={e => setWallet(e.target.value)}
              placeholder="UQ..." style={{ marginBottom: '8px' }} />
            <button className="btn btn-b btn-full" onClick={handleSaveWallet} disabled={loading}>
              {loading ? '[ ⏳ ]' : '[ 💾 СОХРАНИТЬ ]'}
            </button>
          </div>
        </>
      )}

      {/* Портфолио */}
      {tab === 'portfolio' && (
        portfolio.length === 0 ? (
          <div className="gl dc card-stagger-4" style={{ textAlign: 'center', padding: '32px 10px' }}>
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '28px', marginBottom: '8px', animation: 'float 3s ease-in-out infinite' }}>📁</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: '2.2' }}>
              ПОРТФОЛИО ПУСТО<br/>ЗАВЕРШАЙ СДЕЛКИ!
            </div>
          </div>
        ) : (
          portfolio.map((p, i) => (
            <div key={p.id} className={`gl card-stagger-${Math.min(i + 4, 5)}`}>
              <div className="pxgrid" /><div className="sh" />
              <div style={{ fontSize: '9px', color: '#fff', marginBottom: '4px' }}>{p.title?.toUpperCase()}</div>
              <div style={{ fontSize: '9px', color: '#ffaa00' }}>
                ${p.amount_usd} {p.currency}
              </div>
              {p.tags?.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {p.tags.map((tag: string) => (
                    <span key={tag} className="gl-pill"
                      style={{ fontSize: '6px', padding: '2px 7px',
                        color: '#cc44ff', border: '1px solid rgba(204,68,255,0.4)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )
      )}

      {/* Отзывы */}
      {tab === 'reviews' && (
        reviews.length === 0 ? (
          <div className="gl dc card-stagger-4" style={{ textAlign: 'center', padding: '32px 10px' }}>
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '28px', marginBottom: '8px', animation: 'float 3s ease-in-out infinite' }}>⭐</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>
              ОТЗЫВОВ ПОКА НЕТ
            </div>
          </div>
        ) : (
          reviews.map((r, i) => (
            <div key={i} className={`gl card-stagger-${Math.min(i + 4, 5)}`}>
              <div className="pxgrid" /><div className="sh" />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>
                  @{r.reviewer_username}
                </span>
                <span style={{ color: '#ffaa00', fontSize: '9px' }}>{'⭐'.repeat(r.rating)}</span>
              </div>
              {r.comment && (
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.8' }}>
                  {r.comment}
                </div>
              )}
            </div>
          ))
        )
      )}

      <div className="div" />
    </div>
  );
}
