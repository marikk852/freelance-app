import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';

// ============================================================
// Screen: FREELANCERS — list of freelancers with profiles
// ============================================================

const CATEGORY_LABELS: Record<string, string> = {
  design: '🎨 Design', dev: '💻 Dev', writing: '✍️ Writing',
  video: '🎬 Video', marketing: '📣 Marketing', other: '🔧 Other',
};

const EXP_COLOR: Record<string, string> = {
  junior: '#00ff88', middle: '#ffaa00', senior: '#cc44ff',
};

export function FreelancerList() {
  const navigate = useNavigate();
  const { tg } = useTelegram();
  const [freelancers, setFreelancers] = useState<any[]>([]);
  const [filtered,    setFiltered]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState('all');

  useEffect(() => {
    usersApi.freelancers()
      .then(r => { setFreelancers(r.data); setFiltered(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let list = freelancers;
    if (category !== 'all') list = list.filter(f => f.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        (f.first_name || '').toLowerCase().includes(q) ||
        (f.username   || '').toLowerCase().includes(q) ||
        (f.bio        || '').toLowerCase().includes(q) ||
        (f.skills     || []).some((s: string) => s.toLowerCase().includes(q))
      );
    }
    setFiltered(list);
  }, [search, category, freelancers]);

  const go = (path: string) => {
    tg?.HapticFeedback?.impactOccurred('light');
    navigate(path);
  };

  return (
    <div className="page fade-in">

      {/* Header */}
      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(0,136,255,0.3)' }}>
        <div className="pxgrid" /><div className="sh" />
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            fontFamily: '"Press Start 2P", monospace', fontSize: '7px', cursor: 'pointer', padding: 0,
          }}>
          ←
        </button>
        <div className="logo" style={{ fontSize: '10px', color: '#0088ff' }}>👥 FREELANCERS</div>
        <span className="gl-pill" style={{
          fontSize: '7px', padding: '3px 8px',
          color: '#0088ff', border: '1px solid rgba(0,136,255,0.4)',
        }}>
          {filtered.length}
        </span>
      </div>

      {/* Search */}
      <div className="card-stagger-2">
        <input
          className="input"
          placeholder="🔍 Search by name, skill..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', marginBottom: '8px' }}
        />

        {/* Category filter */}
        <div className="filter-row" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: '4px' }}>
          {['all', 'design', 'dev', 'writing', 'video', 'marketing', 'other'].map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`fb ${category === c ? 'fb-on' : 'fb-off'}`}
              style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '6px' }}>
              {c === 'all' ? '🌐 ALL' : CATEGORY_LABELS[c] || c}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '28px' }}>⏳</div>
      ) : filtered.length === 0 ? (
        <div className="gl card-stagger-3" style={{ textAlign: 'center', padding: '32px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔍</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: 2 }}>
            NO FREELANCERS FOUND
          </div>
        </div>
      ) : (
        filtered.map((f, i) => (
          <div
            key={f.telegram_id}
            className={`gl card-stagger-${Math.min(i + 3, 5)}`}
            onClick={() => go(`/profile/${f.telegram_id}`)}
            style={{ cursor: 'pointer', borderColor: 'rgba(0,136,255,0.15)', marginBottom: '8px' }}
          >
            <div className="pxgrid" /><div className="sh" />

            {/* Top row: name + rating */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', position: 'relative', zIndex: 2 }}>
              <div>
                <div style={{ fontSize: '8px', color: '#fff', marginBottom: '2px' }}>
                  {f.first_name?.toUpperCase() || 'FREELANCER'}
                </div>
                {f.username && (
                  <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.3)' }}>@{f.username}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                {f.rating > 0 && (
                  <span style={{ fontSize: '7px', color: '#ffaa00' }}>⭐ {Number(f.rating).toFixed(1)}</span>
                )}
                {f.deals_completed > 0 && (
                  <span style={{ fontSize: '6px', color: '#00ff88' }}>✅ {f.deals_completed}</span>
                )}
              </div>
            </div>

            {/* Bio */}
            {f.bio && (
              <div style={{
                fontSize: '7px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7,
                marginBottom: '8px', position: 'relative', zIndex: 2,
              }}>
                {f.bio.length > 80 ? f.bio.slice(0, 80) + '...' : f.bio}
              </div>
            )}

            {/* Tags: experience + category + skills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', position: 'relative', zIndex: 2 }}>
              {f.experience && (
                <span style={{
                  fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
                  background: `${EXP_COLOR[f.experience]}18`,
                  border: `1px solid ${EXP_COLOR[f.experience]}44`,
                  color: EXP_COLOR[f.experience],
                }}>
                  {f.experience.toUpperCase()}
                </span>
              )}
              {f.category && (
                <span style={{
                  fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
                  background: 'rgba(255,136,0,0.1)', border: '1px solid rgba(255,136,0,0.3)', color: '#ff8800',
                }}>
                  {CATEGORY_LABELS[f.category] || f.category}
                </span>
              )}
              {(f.skills || []).slice(0, 3).map((s: string) => (
                <span key={s} style={{
                  fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
                  background: 'rgba(204,68,255,0.1)', border: '1px solid rgba(204,68,255,0.3)', color: '#cc44ff',
                }}>
                  {s}
                </span>
              ))}
              {(f.skills || []).length > 3 && (
                <span style={{ fontSize: '6px', color: 'rgba(255,255,255,0.25)', padding: '2px 4px' }}>
                  +{f.skills.length - 3}
                </span>
              )}
            </div>

            {/* Footer: country + level + arrow */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: '8px', position: 'relative', zIndex: 2,
            }}>
              <span style={{ fontSize: '6px', color: 'rgba(255,255,255,0.25)' }}>
                {f.country ? `📍 ${f.country}` : ''}{f.level > 1 ? `  ⚔ LVL ${f.level}` : ''}
              </span>
              <span style={{ fontSize: '7px', color: '#0088ff' }}>VIEW →</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
