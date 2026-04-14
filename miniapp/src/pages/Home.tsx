import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { StatusPill } from '../components/GlassCard';
import { useTelegram } from '../hooks/useTelegram';
import { users } from '../utils/api';

export function Home() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const [profile, setProfile] = useState<any>(null);
  const [deals,   setDeals]   = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await users.me();
        setProfile(res.data);
      } catch { /* гость */ }
    })();
  }, []);

  const xp       = profile?.xp ?? 0;
  const xpMax    = 1000;
  const xpPct    = Math.min(100, Math.round((xp / xpMax) * 100));

  return (
    <div className="page fade-in">

      {/* HUD */}
      <div className="gl hud">
        <div className="pxgrid" /><div className="sh" />
        <div className="logo">SAFEDEAL</div>
        <div className="gl-pill lvl" style={{ padding:'3px 8px' }}>
          LVL {profile?.level ?? 1}
        </div>
        <div className="coins">
          <span className="pcoin" style={{ background:'#ffaa00', borderColor:'#ff8800' }} />
          {(profile?.safe_coins ?? 0).toLocaleString()}
        </div>
      </div>

      {/* XP Bar */}
      <div className="gl xp-w">
        <div className="pxgrid" />
        <div className="xp-top">
          <span className="xp-lbl" style={{ color:'#ffaa00' }}>XP</span>
          <span className="xp-lbl">{xp}/{xpMax}</span>
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ background:'linear-gradient(90deg,#ffaa00,#ff6600)', width:`${xpPct}%` }} />
          <div className="xp-shine" />
        </div>
      </div>

      {/* Pixel Scene */}
      <PixelScene scene="home" width={252} height={56} />

      {/* Stats */}
      <div className="stats">
        <div className="stat gl-sm" style={{ borderColor:'rgba(0,136,255,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color:'#0088ff' }}>{profile?.deals_completed ?? 0}</span>
          <span className="stat-l">DONE</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor:'rgba(0,255,136,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color:'#00ff88' }}>{deals.length}</span>
          <span className="stat-l">ACTIVE</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor:'rgba(255,170,0,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color:'#ffaa00' }}>{profile?.rating > 0 ? profile.rating : '—'}</span>
          <span className="stat-l">RANK</span>
        </div>
        <div className="stat gl-sm" style={{ borderColor:'rgba(170,0,255,0.3)' }}>
          <div className="pxgrid" />
          <span className="stat-n" style={{ color:'#cc44ff', fontSize:'11px' }}>🔥{profile?.streak_days ?? 0}</span>
          <span className="stat-l">STREAK</span>
        </div>
      </div>

      {/* Active deals */}
      <div className="sec">-- ACTIVE QUESTS --</div>

      {deals.length === 0 ? (
        <div className="gl dc" style={{ textAlign:'center', padding:'20px 10px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize:'22px', marginBottom:'6px' }}>🏰</div>
          <div style={{ fontSize:'5px', color:'rgba(255,255,255,0.25)', position:'relative', zIndex:2 }}>
            NO QUESTS YET
          </div>
        </div>
      ) : (
        deals.map((d: any) => (
          <div key={d.id} className="dc gl" style={{ borderColor:'rgba(0,136,255,0.35)', cursor:'pointer' }}
            onClick={() => navigate(`/deal/${d.contract_id}`)}>
            <div className="pxgrid" /><div className="sh" />
            <div className="dc-top">
              <div className="dc-title">{d.contract_title?.toUpperCase()}</div>
              <div className="dc-amt" style={{ color:'#00ff88' }}>
                <span className="pcoin" style={{ background:'#00ff88', borderColor:'#00cc55' }} />
                {d.amount_usd} {d.currency}
              </div>
            </div>
            <div className="dc-desc">{d.description}</div>
            <StatusPill status={d.contract_status} />
            <div className="hp-t">
              <div className="hp-b" style={{ '--hp':'60%', background:'linear-gradient(90deg,#0055ff,#44aaff)' } as any} />
            </div>
          </div>
        ))
      )}

      <div className="div" />
      <button className="btn btn-y" onClick={() => navigate('/new-deal')}>
        <div className="sh" />
        [ ⚔ START NEW QUEST ]
      </button>

    </div>
  );
}
