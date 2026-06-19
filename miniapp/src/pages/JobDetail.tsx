import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobs as jobsApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import { PixelScene } from '../components/PixelScene';
import toast from 'react-hot-toast';

// ============================================================
// Screen: JOB DETAIL — детальная страница заказа (/jobs/:id)
// Открывается по клику на карточку в Board. Показывает полное
// описание, бюджет/дедлайн, навыки, карточку клиента и действие:
//  • не владелец, заказ открыт → форма отклика (cover letter + ставка)
//  • уже откликнулся → статус отклика
//  • владелец → список откликнувшихся фрилансеров
// ============================================================

const CATEGORY_LABELS: Record<string, string> = {
  design: '🎨 Design', dev: '💻 Dev', writing: '✍️ Writing',
  video: '🎬 Video', marketing: '📣 Marketing', other: '🔧 Other',
};
const EXP_COLOR: Record<string, string> = {
  junior: '#00ff88', middle: '#ffaa00', senior: '#cc44ff',
};

// Цвет галочки верификации по типу (earned/basic/pro), как в PublicProfile
const verifColor = (t?: string) => t === 'pro' ? '#cc44ff' : t === 'basic' ? '#0088ff' : '#dfe7ef';

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr).getTime();
  if (!d) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);  if (h < 24)  return `${h}h ago`;
  const days = Math.floor(h / 24); if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30); if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

const APP_STATUS: Record<string, { label: string; color: string }> = {
  pending : { label: 'PENDING REVIEW', color: '#ffaa00' },
  accepted: { label: 'ACCEPTED',       color: '#00ff88' },
  rejected: { label: 'DECLINED',       color: '#ff4466' },
};

export function JobDetail() {
  const navigate     = useNavigate();
  const { id }       = useParams<{ id: string }>();
  const { tg }       = useTelegram();

  const [job,     setJob]     = useState<any>(null);
  const [loaded,  setLoaded]  = useState(false);
  const [error,   setError]   = useState(false);

  // Apply form
  const [cover,    setCover]    = useState('');
  const [amount,   setAmount]   = useState('');
  const [applying, setApplying] = useState(false);

  // Applicants (owner only)
  const [applicants,  setApplicants]  = useState<any[] | null>(null);
  const [appsLoading, setAppsLoading] = useState(false);
  const [deciding,    setDeciding]    = useState<string | null>(null);  // appId в процессе

  const load = useCallback(() => {
    if (!id) return;
    setLoaded(false); setError(false);
    jobsApi.get(id)
      .then(r => { setJob(r.data); setLoaded(true); })
      .catch(() => { setError(true); setLoaded(true); });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Telegram BackButton → назад на доску
  useEffect(() => {
    const goBack = () => navigate('/jobs');
    if (!tg?.BackButton) return;
    tg.BackButton.show();
    tg.BackButton.onClick(goBack);
    return () => { tg.BackButton.offClick(goBack); tg.BackButton.hide(); };
  }, [tg, navigate]);

  const handleApply = async () => {
    if (!id) return;
    setApplying(true);
    try {
      await jobsApi.apply(id, {
        cover_letter   : cover.trim() || undefined,
        proposed_amount: amount ? Number(amount) : undefined,
      });
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Application sent!');
      load();   // перечитать → покажет статус отклика
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      const s = e.response?.status;
      toast.error(
        s === 409 ? 'You have already applied'
        : s === 403 ? (e.response?.data?.error || 'Application limit reached')
        : (e.response?.data?.error || 'Failed to apply')
      );
      if (s === 409) load();
    } finally { setApplying(false); }
  };

  const loadApplicants = async () => {
    if (!id) return;
    setAppsLoading(true);
    try {
      const r = await jobsApi.applications(id);
      setApplicants(r.data || []);
    } catch {
      toast.error('Could not load applicants');
    } finally { setAppsLoading(false); }
  };

  // Создать сделку с этим фрилансером — предзаполнить NewDeal данными заказа
  const startDeal = (a: any) => {
    tg?.HapticFeedback?.impactOccurred('medium');
    navigate('/new-deal', { state: { prefill: {
      title             : job.title,
      description       : job.description,
      amount            : job.budget_max ?? job.budget_min ?? '',
      currency          : job.currency || 'USDT',
      freelancerTg      : a.freelancer_telegram_id,
      freelancerName    : a.freelancer_name || a.freelancer_username || 'freelancer',
      freelancerUsername: a.freelancer_username || null,
    } } });
  };

  const decide = async (appId: string, decision: 'accept' | 'reject') => {
    if (!id) return;
    setDeciding(appId);
    try {
      await jobsApi.decideApplication(id, appId, decision);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success(decision === 'accept' ? 'Applicant accepted' : 'Applicant declined');
      await Promise.all([load(), loadApplicants()]);   // обновить статус заказа + список
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Failed');
    } finally { setDeciding(null); }
  };

  // ---- Loading ----
  if (!loaded) {
    return (
      <div className="page fade-in">
        <div className="gl hud" style={{ borderColor: 'rgba(255,170,0,0.3)', justifyContent: 'center' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="logo" style={{ fontSize: '10px', color: '#ffaa00' }}>JOB</div>
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} className="gl" style={{ padding: '14px', marginBottom: '8px' }}>
            <div className="pxgrid" />
            {[70, 95, 45].map((w, j) => (
              <div key={j} style={{ height: '10px', width: `${w}%`, marginBottom: '8px', borderRadius: '5px',
                background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.2s infinite' }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ---- Error / not found ----
  if (error || !job) {
    return (
      <div className="page fade-in">
        <div className="gl" style={{ textAlign: 'center', padding: '32px', marginTop: '12px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>📭</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', lineHeight: 2, marginBottom: '14px' }}>
            JOB NOT FOUND OR REMOVED
          </div>
          <button className="btn btn-y btn-full" style={{ fontSize: '8px' }} onClick={() => navigate('/jobs')}>
            [ ← BACK TO BOARD ]
          </button>
        </div>
      </div>
    );
  }

  const isBoosted = job.boosted_until && new Date(job.boosted_until) > new Date();
  const isOpen    = job.status === 'open';
  const skills    = job.skills_required || [];
  const myApp     = job.my_application;

  return (
    <div className="page fade-in">

      {/* Header */}
      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(255,170,0,0.3)' }}>
        <div className="pxgrid" /><div className="sh" />
        <button onClick={() => navigate('/jobs')} aria-label="Back" style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          fontFamily: '"Press Start 2P", monospace', fontSize: '9px', cursor: 'pointer',
          padding: '10px 12px', margin: '-8px 0 -8px -8px', minWidth: '40px', minHeight: '40px',
        }}>←</button>
        <div className="logo" style={{ fontSize: '10px', color: '#ffaa00' }}>JOB</div>
        <span className="gl-pill" style={{ fontSize: '7px', padding: '3px 8px',
          color: isOpen ? '#00ff88' : 'rgba(255,255,255,0.4)',
          border: `1px solid ${isOpen ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.2)'}` }}>
          {String(job.status || 'open').toUpperCase()}
        </span>
      </div>

      {/* Hero scene */}
      <div className="card-stagger-2" style={{ textAlign: 'center', padding: '8px 8px 4px' }}>
        <PixelScene scene="job_board" />
      </div>

      {/* Main card: title, badges, budget */}
      <div className="gl card-stagger-2" style={{ marginBottom: '8px',
        borderColor: job.highlighted ? 'rgba(204,68,255,0.5)' : 'rgba(255,170,0,0.2)' }}>
        <div className="pxgrid" /><div className="sh" />

        {(isBoosted || job.urgent) && (
          <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
            {isBoosted && <span className="px" style={{ fontSize: '5px', color: '#000', background: '#ffaa00', padding: '3px 6px', borderRadius: '4px' }}>⬆ TOP</span>}
            {job.urgent && <span className="px" style={{ fontSize: '5px', color: '#fff', background: '#ff4466', padding: '3px 6px', borderRadius: '4px' }}>🔥 URGENT</span>}
          </div>
        )}

        <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '11px', color: '#ffaa00', lineHeight: 1.6, marginBottom: '10px', position: 'relative', zIndex: 2 }}>
          {job.title?.toUpperCase()}
        </div>

        {/* Budget + currency */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px', position: 'relative', zIndex: 2 }}>
          <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '14px', color: '#00ff88' }}>
            {job.budget_min != null && job.budget_max != null
              ? `$${job.budget_min}–$${job.budget_max}`
              : job.budget_max != null ? `up to $${job.budget_max}`
              : job.budget_min != null ? `from $${job.budget_min}`
              : 'Negotiable'}
          </span>
          <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.35)' }}>{job.currency || 'USDT'}</span>
        </div>

        {/* Meta chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', position: 'relative', zIndex: 2 }}>
          {job.category && (
            <span style={{ fontSize: '7px', padding: '4px 9px', borderRadius: '6px',
              background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', color: '#ffaa00' }}>
              {CATEGORY_LABELS[job.category] || job.category}
            </span>
          )}
          {job.deadline && (
            <span style={{ fontSize: '7px', padding: '4px 9px', borderRadius: '6px',
              background: 'rgba(255,136,0,0.1)', border: '1px solid rgba(255,136,0,0.3)', color: '#ff8800' }}>
              ⏱ {job.deadline} {job.deadline === 1 ? 'day' : 'days'}
            </span>
          )}
          <span style={{ fontSize: '7px', padding: '4px 9px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>
            📨 {Number(job.applications_count) || 0} {Number(job.applications_count) === 1 ? 'applicant' : 'applicants'}
          </span>
          {job.created_at && (
            <span style={{ fontSize: '7px', padding: '4px 9px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>
              {timeAgo(job.created_at)}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {job.description && (
        <div className="gl card-stagger-3" style={{ marginBottom: '8px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="px" style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
            DESCRIPTION
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.75, whiteSpace: 'pre-wrap', position: 'relative', zIndex: 2 }}>
            {job.description}
          </div>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="gl card-stagger-3" style={{ marginBottom: '8px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="px" style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px', position: 'relative', zIndex: 2 }}>
            SKILLS REQUIRED
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', position: 'relative', zIndex: 2 }}>
            {skills.map((s: string) => (
              <span key={s} style={{ fontSize: '8px', padding: '4px 9px', borderRadius: '6px',
                background: 'rgba(204,68,255,0.1)', border: '1px solid rgba(204,68,255,0.3)', color: '#cc44ff' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Client card */}
      <div className="gl card-stagger-3" style={{ marginBottom: '8px', cursor: 'pointer' }}
        onClick={() => { tg?.HapticFeedback?.impactOccurred('light'); navigate(`/profile/${job.client_tg}`); }}>
        <div className="pxgrid" /><div className="sh" />
        <div className="px" style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px', position: 'relative', zIndex: 2 }}>
          POSTED BY
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color: '#fff' }}>
                {(job.client_name || job.client_username || 'CLIENT').toUpperCase()}
              </span>
              {job.client_verification && (
                <span style={{ fontSize: '8px', color: verifColor(job.client_verification) }}>✓</span>
              )}
            </div>
            {job.client_username && <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>@{job.client_username}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
            {job.client_rating > 0 && <span style={{ fontSize: '8px', color: '#ffaa00' }}>⭐ {Number(job.client_rating).toFixed(1)}</span>}
            {job.client_deals > 0 && <span style={{ fontSize: '7px', color: '#00ff88' }}>✅ {job.client_deals} deals</span>}
            <span style={{ fontSize: '8px', color: '#0088ff' }}>VIEW →</span>
          </div>
        </div>
      </div>

      {/* ── ACTION AREA ── */}

      {/* Owner: applicants */}
      {job.is_owner && (
        <div className="gl card-stagger-3" style={{ marginBottom: '8px', borderColor: 'rgba(0,136,255,0.25)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="px" style={{ fontSize: '8px', color: '#0088ff', marginBottom: '10px', position: 'relative', zIndex: 2 }}>
            👥 YOUR JOB · {Number(job.applications_count) || 0} APPLICANT{Number(job.applications_count) === 1 ? '' : 'S'}
          </div>
          {applicants === null ? (
            <button className="btn btn-full" disabled={appsLoading} style={{ fontSize: '7px',
              background: 'rgba(0,136,255,0.12)', borderColor: 'rgba(0,136,255,0.4)', color: '#0088ff', position: 'relative', zIndex: 2 }}
              onClick={loadApplicants}>
              {appsLoading ? '[ ⏳ LOADING... ]' : '[ ▾ VIEW APPLICANTS ]'}
            </button>
          ) : applicants.length === 0 ? (
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '10px 0', position: 'relative', zIndex: 2 }}>
              NO APPLICANTS YET
            </div>
          ) : (
            <div style={{ position: 'relative', zIndex: 2 }}>
              {applicants.map(a => (
                <div key={a.id} className="gl-sm" style={{ padding: '10px 12px', marginBottom: '7px', cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
                  onClick={() => navigate(`/profile/${a.freelancer_telegram_id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: a.cover_letter ? '6px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                        {a.freelancer_name || a.freelancer_username || 'Freelancer'}
                      </span>
                      {a.freelancer_experience && (
                        <span style={{ fontSize: '6px', padding: '2px 6px', borderRadius: '4px',
                          background: `${EXP_COLOR[a.freelancer_experience]}18`, border: `1px solid ${EXP_COLOR[a.freelancer_experience]}44`,
                          color: EXP_COLOR[a.freelancer_experience] }}>
                          {a.freelancer_experience.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {a.proposed_amount != null && (
                      <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#00ff88' }}>${a.proposed_amount}</span>
                    )}
                  </div>
                  {a.cover_letter && (
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                      {a.cover_letter}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>
                      {a.freelancer_rating > 0 ? `⭐ ${Number(a.freelancer_rating).toFixed(1)}  ` : ''}
                      {a.freelancer_deals_completed > 0 ? `✅ ${a.freelancer_deals_completed}` : ''}
                    </span>
                    <span style={{ fontSize: '8px', color: '#0088ff' }}>PROFILE →</span>
                  </div>

                  {/* Решение по отклику */}
                  {a.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: '7px', marginTop: '9px' }}>
                      <button disabled={deciding === a.id}
                        onClick={(e) => { e.stopPropagation(); decide(a.id, 'accept'); }}
                        className="btn" style={{ flex: 1, fontSize: '7px',
                          background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.4)', color: '#00ff88' }}>
                        {deciding === a.id ? '...' : '✓ ACCEPT'}
                      </button>
                      <button disabled={deciding === a.id}
                        onClick={(e) => { e.stopPropagation(); decide(a.id, 'reject'); }}
                        className="btn" style={{ flex: 1, fontSize: '7px',
                          background: 'rgba(255,68,102,0.1)', border: '1px solid rgba(255,68,102,0.35)', color: '#ff4466' }}>
                        {deciding === a.id ? '...' : '✕ DECLINE'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '9px' }}>
                      <span className="px" style={{ fontSize: '6px', padding: '3px 8px', borderRadius: '4px',
                        color: (APP_STATUS[a.status] || APP_STATUS.pending).color,
                        border: `1px solid ${(APP_STATUS[a.status] || APP_STATUS.pending).color}55`,
                        background: `${(APP_STATUS[a.status] || APP_STATUS.pending).color}14` }}>
                        {(APP_STATUS[a.status] || APP_STATUS.pending).label}
                      </span>
                      {a.status === 'accepted' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startDeal(a); }}
                          className="btn btn-full" style={{ marginTop: '9px', fontSize: '7px',
                            background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.45)', color: '#00ff88' }}>
                          [ ⚔ CREATE DEAL WITH THIS FREELANCER ]
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Already applied */}
      {!job.is_owner && myApp && (
        <div className="gl card-stagger-3" style={{ marginBottom: '8px',
          borderColor: `${(APP_STATUS[myApp.status] || APP_STATUS.pending).color}55` }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>
              {myApp.status === 'accepted' ? '🎉' : myApp.status === 'rejected' ? '🚫' : '⏳'}
            </div>
            <div className="px" style={{ fontSize: '8px', color: (APP_STATUS[myApp.status] || APP_STATUS.pending).color, marginBottom: '6px' }}>
              {(APP_STATUS[myApp.status] || APP_STATUS.pending).label}
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
              You applied {timeAgo(myApp.created_at)}
              {myApp.proposed_amount != null ? ` · proposed $${myApp.proposed_amount}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Apply form (not owner, open, not applied yet) */}
      {!job.is_owner && isOpen && !myApp && (
        <div className="gl card-stagger-3" style={{ marginBottom: '8px', borderColor: 'rgba(0,255,136,0.25)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="px" style={{ fontSize: '8px', color: '#00ff88', marginBottom: '12px', position: 'relative', zIndex: 2 }}>
            ✍️ APPLY FOR THIS JOB
          </div>
          <div style={{ marginBottom: '10px', position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}>Cover letter</div>
            <textarea className="input" placeholder="Why you're a good fit, relevant experience..."
              value={cover} onChange={e => setCover(e.target.value)}
              style={{ width: '100%', minHeight: '90px', resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '12px', position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}>Your rate ($) — optional</div>
            <input className="input" type="number" inputMode="numeric"
              placeholder={job.budget_max ? String(job.budget_max) : '100'}
              value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button className="btn btn-gr btn-full" disabled={applying} style={{ fontSize: '8px', position: 'relative', zIndex: 2 }}
            onClick={handleApply}>
            {applying ? '[ ⏳ SENDING... ]' : '[ 🚀 SEND APPLICATION ]'}
          </button>
        </div>
      )}

      {/* Closed / taken */}
      {!job.is_owner && !isOpen && !myApp && (
        <div className="gl card-stagger-3" style={{ marginBottom: '8px', textAlign: 'center', padding: '24px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '22px', marginBottom: '8px' }}>🔒</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', lineHeight: 2 }}>
            THIS JOB IS NO LONGER ACCEPTING APPLICATIONS
          </div>
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}
