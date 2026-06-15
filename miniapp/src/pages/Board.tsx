import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jobs as jobsApi, users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Screen: BOARD — Jobs + Freelancers combined with tab switcher
// ============================================================

const CATEGORIES = ['all', 'design', 'dev', 'writing', 'video', 'marketing', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  design: '🎨 Design', dev: '💻 Dev', writing: '✍️ Writing',
  video: '🎬 Video', marketing: '📣 Marketing', other: '🔧 Other',
};
const EXP_COLOR: Record<string, string> = {
  junior: '#00ff88', middle: '#ffaa00', senior: '#cc44ff',
};

// Profile completion check popup
function ProfileIncompletePopup({ role, onClose, onGo }: { role: string; onClose: () => void; onGo: () => void }) {
  const missing = role === 'freelancer'
    ? 'bio, country, portfolio/website link, skills and category'
    : 'bio, country and a portfolio or website link';
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
      }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', zIndex: 9991,
        transform: 'translate(-50%,-50%)',
        width: 'min(320px, 90vw)',
        background: '#0e0e0e',
        border: '1px solid rgba(255,170,0,0.3)',
        borderRadius: '18px',
        padding: '24px 20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
          Complete your profile first
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '20px' }}>
          To start working on SafeDeal you need to fill in: {missing}
        </div>
        <button onClick={onGo} style={{
          width: '100%', padding: '13px',
          background: '#ffaa00', color: '#000',
          border: 'none', borderRadius: '12px',
          fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700,
          cursor: 'pointer', marginBottom: '8px',
        }}>
          Go to Profile
        </button>
        <button onClick={onClose} style={{
          width: '100%', padding: '10px',
          background: 'transparent', color: 'rgba(255,255,255,0.4)',
          border: 'none', borderRadius: '12px',
          fontFamily: 'Inter, sans-serif', fontSize: '13px',
          cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </>
  );
}

export function Board() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const { tg, user }  = useTelegram();
  const initialTab    = params.get('tab') === 'freelancers' ? 'freelancers' : 'jobs';
  const [tab, setTab] = useState<'jobs' | 'freelancers'>(initialTab as any);

  // Jobs state
  const [jobs,       setJobs]       = useState<any[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [boostJob,   setBoostJob]   = useState<any>(null);
  const [boosting,   setBoosting]   = useState(false);

  const BOOST_OPTIONS = [
    { key: 'boost_top_24h',   label: 'Top for 24h',     cost: 300 },
    { key: 'boost_top_72h',   label: 'Top for 72h',     cost: 700 },
    { key: 'highlight_color', label: 'Highlight color',  cost: 150 },
    { key: 'urgent_badge',    label: 'Urgent badge',     cost: 200 },
  ];

  const doBoost = async (key: string) => {
    if (!boostJob) return;
    setBoosting(true);
    try {
      const r = await jobsApi.boost(boostJob.id, key);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success(`Boosted! ${r.data.balance} 💎 left`);
      setBoostJob(null);
      jobsApi.list().then(res => setJobs(res.data)).catch(() => {});
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.status === 402 ? 'Not enough crystals' : (e.response?.data?.error || 'Failed'));
    } finally { setBoosting(false); }
  };
  const [category,   setCategory]   = useState('all');
  const [search,     setSearch]     = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Freelancers state
  const [freelancers,   setFreelancers]   = useState<any[]>([]);
  const [freLoaded,     setFreLoaded]     = useState(false);
  const [freSearch,     setFreSearch]     = useState('');
  const [freCat,        setFreCat]        = useState('all');

  // Profile check
  const [meProfile,     setMeProfile]     = useState<any>(null);
  const [showIncomplete, setShowIncomplete] = useState(false);

  const go = (path: string) => {
    tg?.HapticFeedback?.impactOccurred('light');
    navigate(path);
  };

  // Fetch user profile for completion check
  useEffect(() => {
    usersApi.me().then(r => setMeProfile(r.data)).catch(() => {});
  }, []);

  // Fetch jobs
  useEffect(() => {
    if (tab !== 'jobs' || jobsLoaded) return;
    jobsApi.list().then(r => { setJobs(r.data); setJobsLoaded(true); }).catch(() => {});
  }, [tab, jobsLoaded]);

  // Fetch freelancers
  useEffect(() => {
    if (tab !== 'freelancers' || freLoaded) return;
    usersApi.freelancers().then(r => { setFreelancers(r.data); setFreLoaded(true); }).catch(() => {});
  }, [tab, freLoaded]);

  // Filter jobs
  const filteredJobs = jobs.filter(j => {
    if (category !== 'all' && j.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (j.title || '').toLowerCase().includes(q) || (j.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Filter freelancers
  const filteredFre = freelancers.filter(f => {
    if (freCat !== 'all' && f.category !== freCat) return false;
    if (freSearch.trim()) {
      const q = freSearch.toLowerCase();
      return (f.first_name || '').toLowerCase().includes(q) ||
             (f.username || '').toLowerCase().includes(q) ||
             (f.bio || '').toLowerCase().includes(q) ||
             (f.skills || []).some((s: string) => s.toLowerCase().includes(q));
    }
    return true;
  });

  // Check profile completeness before showing create form
  const isProfileComplete = () => {
    if (!meProfile) return false;
    const role = meProfile.role || meProfile.account_type || 'client';
    if (role === 'freelancer') {
      return !!(meProfile.bio && meProfile.country && meProfile.category && meProfile.skills?.length &&
               (meProfile.portfolio_url || meProfile.github_url || meProfile.company_url));
    }
    return !!(meProfile.bio && meProfile.country &&
             (meProfile.portfolio_url || meProfile.company_url || meProfile.github_url));
  };

  const handleStartWorking = () => {
    if (!isProfileComplete()) {
      setShowIncomplete(true);
    } else {
      setShowCreate(true);
    }
  };

  // ---- Job card ----
  const JobCard = ({ job }: { job: any }) => {
   const isBoosted = job.boosted_until && new Date(job.boosted_until) > new Date();
   const isOwn = user && Number(job.client_tg) === Number(user.id);
   return (
    <div className="gl" style={{ marginBottom: '8px', cursor: 'pointer',
      borderColor: job.highlighted ? 'rgba(204,68,255,0.5)' : isBoosted ? 'rgba(255,170,0,0.5)' : 'rgba(255,170,0,0.15)',
      boxShadow: job.highlighted ? '0 0 16px rgba(204,68,255,0.25)' : isBoosted ? '0 0 12px rgba(255,170,0,0.2)' : 'none' }}
      onClick={() => go(`/jobs/${job.id}`)}>
      <div className="pxgrid" /><div className="sh" />
      {(isBoosted || job.urgent) && (
        <div style={{ display: 'flex', gap: '5px', marginBottom: '6px', position: 'relative', zIndex: 2 }}>
          {isBoosted && <span className="px" style={{ fontSize: '5px', color: '#000', background: '#ffaa00', padding: '3px 6px', borderRadius: '4px' }}>⬆ TOP</span>}
          {job.urgent && <span className="px" style={{ fontSize: '5px', color: '#fff', background: '#ff4466', padding: '3px 6px', borderRadius: '4px' }}>🔥 URGENT</span>}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', position: 'relative', zIndex: 2 }}>
        <div style={{ flex: 1, marginRight: '8px' }}>
          <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#ffaa00', lineHeight: 1.5, marginBottom: '4px' }}>
            {job.title?.toUpperCase()}
          </div>
          {job.category && (
            <span style={{ fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
              background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', color: '#ffaa00' }}>
              {CATEGORY_LABELS[job.category] || job.category}
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#00ff88' }}>
            ${job.budget_min}–${job.budget_max}
          </div>
          <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>
            {job.currency || 'USDT'}
          </div>
        </div>
      </div>
      {job.description && (
        <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, position: 'relative', zIndex: 2, marginBottom: '8px' }}>
          {job.description.length > 100 ? job.description.slice(0, 100) + '...' : job.description}
        </div>
      )}
      {(job.skills_required || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', position: 'relative', zIndex: 2 }}>
          {job.skills_required.slice(0, 4).map((s: string) => (
            <span key={s} style={{ fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
              background: 'rgba(204,68,255,0.1)', border: '1px solid rgba(204,68,255,0.3)', color: '#cc44ff' }}>
              {s}
            </span>
          ))}
        </div>
      )}
      {isOwn && job.status === 'open' && (
        <button
          onClick={(e) => { e.stopPropagation(); setBoostJob(job); }}
          className="btn" style={{ marginTop: '8px', fontSize: '7px', background: 'rgba(255,170,0,0.12)', border: '1px solid rgba(255,170,0,0.4)', color: '#ffaa00' }}>
          [ ⬆ BOOST THIS JOB ]
        </button>
      )}
    </div>
   );
  };

  // ---- Freelancer card ----
  const FreCard = ({ f }: { f: any }) => (
    <div className="gl" style={{ marginBottom: '8px', borderColor: 'rgba(0,136,255,0.15)', cursor: 'pointer' }}
      onClick={() => go(`/profile/${f.telegram_id}`)}>
      <div className="pxgrid" /><div className="sh" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', position: 'relative', zIndex: 2 }}>
        <div>
          <div style={{ fontSize: '8px', color: '#fff', marginBottom: '2px' }}>
            {f.first_name?.toUpperCase() || 'FREELANCER'}
          </div>
          {f.username && <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.3)' }}>@{f.username}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
          {f.rating > 0 && <span style={{ fontSize: '7px', color: '#ffaa00' }}>⭐ {Number(f.rating).toFixed(1)}</span>}
          {f.deals_completed > 0 && <span style={{ fontSize: '6px', color: '#00ff88' }}>✅ {f.deals_completed}</span>}
        </div>
      </div>
      {f.bio && (
        <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '8px', position: 'relative', zIndex: 2 }}>
          {f.bio.length > 80 ? f.bio.slice(0, 80) + '...' : f.bio}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', position: 'relative', zIndex: 2 }}>
        {f.experience && (
          <span style={{ fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
            background: `${EXP_COLOR[f.experience]}18`, border: `1px solid ${EXP_COLOR[f.experience]}44`,
            color: EXP_COLOR[f.experience] }}>
            {f.experience.toUpperCase()}
          </span>
        )}
        {f.category && (
          <span style={{ fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
            background: 'rgba(255,136,0,0.1)', border: '1px solid rgba(255,136,0,0.3)', color: '#ff8800' }}>
            {CATEGORY_LABELS[f.category] || f.category}
          </span>
        )}
        {(f.skills || []).slice(0, 3).map((s: string) => (
          <span key={s} style={{ fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
            background: 'rgba(204,68,255,0.1)', border: '1px solid rgba(204,68,255,0.3)', color: '#cc44ff' }}>
            {s}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', position: 'relative', zIndex: 2 }}>
        <span style={{ fontSize: '6px', color: 'rgba(255,255,255,0.25)' }}>
          {f.country ? `📍 ${f.country}` : ''}{f.level > 1 ? `  ⚔ LVL ${f.level}` : ''}
        </span>
        <span style={{ fontSize: '7px', color: '#0088ff' }}>VIEW →</span>
      </div>
    </div>
  );

  return (
    <div className="page fade-in">

      {/* Header */}
      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(255,170,0,0.3)' }}>
        <div className="pxgrid" /><div className="sh" />
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          fontFamily: '"Press Start 2P", monospace', fontSize: '7px', cursor: 'pointer', padding: 0,
        }}>←</button>
        <div className="logo" style={{ fontSize: '10px', color: '#ffaa00' }}>BOARD</div>
        <span className="gl-pill" style={{ fontSize: '7px', padding: '3px 8px', color: '#ffaa00', border: '1px solid rgba(255,170,0,0.4)' }}>
          {tab === 'jobs' ? filteredJobs.length : filteredFre.length}
        </span>
      </div>

      {/* Tab switcher */}
      <div className="card-stagger-2" style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <button onClick={() => setTab('jobs')} style={{
          flex: 1, padding: '10px',
          background: tab === 'jobs' ? '#ffaa00' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${tab === 'jobs' ? '#ffaa00' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '10px', cursor: 'pointer',
          fontFamily: '"Press Start 2P", monospace', fontSize: '7px',
          color: tab === 'jobs' ? '#000' : 'rgba(255,255,255,0.5)',
          transition: 'all 0.2s',
        }}>
          💼 JOBS
        </button>
        <button onClick={() => setTab('freelancers')} style={{
          flex: 1, padding: '10px',
          background: tab === 'freelancers' ? '#0088ff' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${tab === 'freelancers' ? '#0088ff' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '10px', cursor: 'pointer',
          fontFamily: '"Press Start 2P", monospace', fontSize: '7px',
          color: tab === 'freelancers' ? '#fff' : 'rgba(255,255,255,0.5)',
          transition: 'all 0.2s',
        }}>
          👥 FREELANCERS
        </button>
      </div>

      {/* ── JOBS TAB ── */}
      {tab === 'jobs' && (
        <>
          <input className="input" placeholder="🔍 Search jobs..." value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', marginBottom: '8px' }} />
          <div className="filter-row" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: '4px', marginBottom: '8px' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`fb ${category === c ? 'fb-on' : 'fb-off'}`}
                style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '6px' }}>
                {c === 'all' ? '🌐 ALL' : CATEGORY_LABELS[c] || c}
              </button>
            ))}
          </div>

          {/* Post a job button */}
          <button onClick={handleStartWorking} className="btn btn-full" style={{
            marginBottom: '12px', fontSize: '7px',
            background: 'rgba(255,170,0,0.15)', borderColor: 'rgba(255,170,0,0.4)', color: '#ffaa00',
          }}>
            + POST A JOB
          </button>

          {!jobsLoaded ? (
            <div style={{ textAlign: 'center', padding: '40px', fontSize: '28px' }}>⏳</div>
          ) : filteredJobs.length === 0 ? (
            <div className="gl" style={{ textAlign: 'center', padding: '32px' }}>
              <div className="pxgrid" /><div className="sh" />
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>📭</div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: 2 }}>NO JOBS FOUND</div>
            </div>
          ) : (
            filteredJobs.map(job => <JobCard key={job.id} job={job} />)
          )}
        </>
      )}

      {/* ── FREELANCERS TAB ── */}
      {tab === 'freelancers' && (
        <>
          <input className="input" placeholder="🔍 Search by name, skill..." value={freSearch}
            onChange={e => setFreSearch(e.target.value)}
            style={{ width: '100%', marginBottom: '8px' }} />
          <div className="filter-row" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: '4px', marginBottom: '8px' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setFreCat(c)}
                className={`fb ${freCat === c ? 'fb-on' : 'fb-off'}`}
                style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '6px' }}>
                {c === 'all' ? '🌐 ALL' : CATEGORY_LABELS[c] || c}
              </button>
            ))}
          </div>

          {!freLoaded ? (
            <div style={{ textAlign: 'center', padding: '40px', fontSize: '28px' }}>⏳</div>
          ) : filteredFre.length === 0 ? (
            <div className="gl" style={{ textAlign: 'center', padding: '32px' }}>
              <div className="pxgrid" /><div className="sh" />
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔍</div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: 2 }}>NO FREELANCERS FOUND</div>
            </div>
          ) : (
            filteredFre.map(f => <FreCard key={f.telegram_id} f={f} />)
          )}
        </>
      )}

      {/* Profile incomplete popup */}
      {showIncomplete && (
        <ProfileIncompletePopup
          role={meProfile?.role || meProfile?.account_type || 'client'}
          onClose={() => setShowIncomplete(false)}
          onGo={() => { setShowIncomplete(false); go('/profile'); }}
        />
      )}

      {/* Boost picker */}
      {boostJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setBoostJob(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg-dark2,#08080e)', borderTop: '1px solid rgba(255,170,0,0.4)', borderRadius: '18px 18px 0 0', padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <div className="px" style={{ fontSize: '9px', color: '#ffaa00', marginBottom: '4px' }}>⬆ BOOST JOB</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>{boostJob.title}</div>
            {BOOST_OPTIONS.map(o => (
              <button key={o.key} disabled={boosting} onClick={() => doBoost(o.key)}
                className="gl-sm" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 12px', marginBottom: '7px', border: '1px solid rgba(255,170,0,0.25)', cursor: 'pointer', background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#fff' }}>{o.label}</span>
                <span className="px" style={{ fontSize: '8px', color: '#ffaa00' }}>{o.cost} 💎</span>
              </button>
            ))}
            <button className="btn btn-gr btn-full" style={{ fontSize: '7px', marginTop: '4px' }} onClick={() => setBoostJob(null)}>[ CANCEL ]</button>
          </div>
        </div>
      )}
    </div>
  );
}
