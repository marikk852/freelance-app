import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { GlassCard } from '../components/GlassCard';
import { jobs as jobsApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Screen 09: JOB BOARD — job exchange, filters, posting
// ============================================================

const CATEGORIES = ['All', 'design', 'dev', 'writing', 'video', 'marketing', 'other'];

// ---- Список откликов на конкретный заказ ----
function ApplicationsList({ jobId, jobTitle, onBack }: { jobId: string; jobTitle: string; onBack: () => void }) {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    jobsApi.applications(jobId)
      .then(r => setApps(r.data))
      .catch(() => toast.error('Error loading applications'))
      .finally(() => setLoading(false));
  }, [jobId]);

  return (
    <div>
      <button className="btn btn-ghost btn-full" style={{ marginBottom: '10px', fontSize: '7px' }}
        onClick={onBack}>
        ← BACK
      </button>

      <div className="gl hud" style={{ borderColor: 'rgba(204,68,255,0.3)', marginBottom: '10px' }}>
        <div className="pxgrid" /><div className="sh" />
        <div>
          <div style={{ fontSize: '8px', color: '#cc44ff' }}>📋 APPLICATIONS</div>
          <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginTop: '3px', lineHeight: 1.5 }}>
            {jobTitle.toUpperCase()}
          </div>
        </div>
        <div style={{
          fontSize: '11px', color: '#cc44ff', fontFamily: '"Press Start 2P", monospace',
        }}>{apps.length}</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px', fontSize: '24px' }}>⏳</div>
      ) : apps.length === 0 ? (
        <GlassCard style={{ textAlign: 'center', padding: '32px' }}>
          <div style={{ fontSize: '24px' }}>📭</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
            NO APPLICATIONS YET
          </div>
        </GlassCard>
      ) : (
        apps.map(app => (
          <div key={app.id} className="gl" style={{ marginBottom: '8px', borderColor: 'rgba(204,68,255,0.2)' }}>
            <div className="pxgrid" /><div className="sh" />

            {/* Шапка: имя + рейтинг */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
              <div>
                <div style={{ fontSize: '8px', color: '#fff' }}>
                  {app.freelancer_name || app.freelancer_username || 'Freelancer'}
                </div>
                {app.freelancer_username && (
                  <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                    @{app.freelancer_username}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                {app.freelancer_rating > 0 && (
                  <span style={{ fontSize: '7px', color: '#ffaa00' }}>
                    ⭐ {Number(app.freelancer_rating).toFixed(1)}
                  </span>
                )}
                {app.proposed_amount && (
                  <span style={{ fontSize: '7px', color: '#00ff88' }}>
                    ${app.proposed_amount}
                  </span>
                )}
              </div>
            </div>

            {/* Сопроводительное письмо */}
            {app.cover_letter && (
              <div style={{
                fontSize: '7px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7,
                background: 'rgba(255,255,255,0.04)', borderRadius: '4px',
                padding: '8px', marginBottom: '8px', position: 'relative', zIndex: 2,
              }}>
                {app.cover_letter}
              </div>
            )}

            {/* Скилы + опыт */}
            {(app.freelancer_skills?.length > 0 || app.freelancer_experience) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                {app.freelancer_experience && (
                  <span style={{
                    fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
                    background: 'rgba(0,136,255,0.12)', border: '1px solid rgba(0,136,255,0.35)', color: '#0088ff',
                  }}>
                    {app.freelancer_experience.toUpperCase()}
                  </span>
                )}
                {app.freelancer_category && (
                  <span style={{
                    fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
                    background: 'rgba(255,136,0,0.12)', border: '1px solid rgba(255,136,0,0.35)', color: '#ff8800',
                  }}>
                    {app.freelancer_category}
                  </span>
                )}
                {(app.freelancer_skills || []).slice(0, 4).map((s: string) => (
                  <span key={s} style={{
                    fontSize: '6px', padding: '2px 7px', borderRadius: '4px',
                    background: 'rgba(204,68,255,0.1)', border: '1px solid rgba(204,68,255,0.3)', color: '#cc44ff',
                  }}>{s}</span>
                ))}
              </div>
            )}

            {/* Статус + кнопка профиля */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
              <span style={{
                fontSize: '6px', padding: '3px 8px', borderRadius: '4px',
                background: app.status === 'accepted' ? 'rgba(0,255,136,0.12)' :
                            app.status === 'rejected' ? 'rgba(255,68,102,0.12)' :
                            'rgba(255,170,0,0.12)',
                border: `1px solid ${app.status === 'accepted' ? 'rgba(0,255,136,0.4)' :
                                      app.status === 'rejected' ? 'rgba(255,68,102,0.4)' :
                                      'rgba(255,170,0,0.4)'}`,
                color: app.status === 'accepted' ? '#00ff88' :
                       app.status === 'rejected' ? '#ff4466' : '#ffaa00',
              }}>
                {app.status === 'accepted' ? '✅ ACCEPTED' :
                 app.status === 'rejected' ? '❌ REJECTED' : '⏳ PENDING'}
              </span>
              {app.freelancer_telegram_id && (
                <button
                  className="btn"
                  style={{ fontSize: '6px', padding: '4px 10px', margin: 0,
                    background: 'rgba(0,136,255,0.15)', border: '1px solid rgba(0,136,255,0.4)',
                    color: '#0088ff', borderRadius: '5px' }}
                  onClick={() => navigate(`/profile/${app.freelancer_telegram_id}`)}>
                  👤 VIEW PROFILE
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---- My jobs (as client) ----
function MyJobs() {
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    jobsApi.my()
      .then(r => setMyJobs(r.data))
      .catch(() => setMyJobs([]))
      .finally(() => setLoading(false));
  }, []);

  if (selectedJob) {
    return (
      <ApplicationsList
        jobId={selectedJob.id}
        jobTitle={selectedJob.title}
        onBack={() => setSelectedJob(null)}
      />
    );
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '32px', fontSize: '24px' }}>⏳</div>
  );

  if (myJobs.length === 0) return (
    <GlassCard style={{ textAlign: 'center', padding: '32px' }}>
      <div style={{ fontSize: '24px' }}>📭</div>
      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
        YOU HAVE NOT POSTED ANY JOBS
      </div>
    </GlassCard>
  );

  return (
    <>
      {myJobs.map(j => (
        <div key={j.id} className="gl" style={{ marginBottom: '8px', borderColor: 'rgba(255,136,0,0.25)', cursor: 'pointer' }}
          onClick={() => setSelectedJob({ id: j.id, title: j.title })}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
            <div style={{ flex: 1, marginRight: '8px' }}>
              <div style={{ fontSize: '8px', color: '#fff', marginBottom: '4px', lineHeight: 1.4 }}>
                {j.title.toUpperCase()}
              </div>
              <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.35)' }}>
                {j.category || 'general'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
              <span style={{
                fontSize: '6px', padding: '3px 7px', borderRadius: '4px',
                background: j.status === 'open' ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${j.status === 'open' ? 'rgba(0,255,136,0.35)' : 'rgba(255,255,255,0.15)'}`,
                color: j.status === 'open' ? '#00ff88' : 'rgba(255,255,255,0.4)',
              }}>
                {j.status.toUpperCase()}
              </span>
              <span style={{ fontSize: '7px', color: '#cc44ff' }}>
                📨 {j.applications_count} apps.
              </span>
            </div>
          </div>
          {(j.budget_min || j.budget_max) && (
            <div style={{ fontSize: '7px', color: '#ffaa00', marginTop: '6px', position: 'relative', zIndex: 2 }}>
              💰 {j.budget_min ? `$${j.budget_min}` : ''}{j.budget_max ? `—$${j.budget_max}` : ''} {j.currency}
            </div>
          )}
          <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.25)', marginTop: '4px', position: 'relative', zIndex: 2 }}>
            tap to view applications →
          </div>
        </div>
      ))}
    </>
  );
}

// ---- Main component ----
export function JobBoard() {
  const { tg } = useTelegram();
  const [jobs,     setJobs]     = useState<any[]>([]);
  const [category, setCategory] = useState('All');
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<'list' | 'my' | 'create'>('list');
  const [form, setForm] = useState({
    title: '', description: '', budget_min: '', budget_max: '',
    currency: 'USDT', deadline: '', category: 'dev', skills_required: '',
  });

  useEffect(() => {
    if (tab === 'list') loadJobs();
  }, [category, tab]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (category !== 'All') params.category = category;
      if (search) params.search = search;
      const res = await jobsApi.list(params);
      setJobs(res.data);
    } catch { setJobs([]); } finally { setLoading(false); }
  };

  const switchTab = (t: typeof tab) => {
    tg?.HapticFeedback?.selectionChanged();
    setTab(t);
  };

  const handleCreate = async () => {
    if (!form.title || !form.description) return toast.error('Fill in required fields');
    try {
      await jobsApi.create({
        ...form,
        budget_min     : form.budget_min ? Number(form.budget_min) : undefined,
        budget_max     : form.budget_max ? Number(form.budget_max) : undefined,
        deadline       : form.deadline ? Number(form.deadline) : undefined,
        skills_required: form.skills_required.split(',').map(s => s.trim()).filter(Boolean),
      });
      toast.success('Job posted!');
      switchTab('my');
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error'); }
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="job_board" width={320} height={110} />

      {/* Заголовок */}
      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(255,136,0,0.3)' }}>
        <div className="pxgrid" /><div className="sh" />
        <div className="logo" style={{ fontSize: '10px', color: '#ff8800' }}>📌 JOB BOARD</div>
      </div>

      {/* Табы */}
      <div className="filter-row card-stagger-2">
        {(['list', 'my', 'create'] as const).map(t => (
          <button key={t} onClick={() => switchTab(t)}
            className={`fb ${tab === t ? 'fb-on' : 'fb-off'}`}>
            {t === 'list' ? '🔍 JOBS' : t === 'my' ? '📋 MY' : '+ NEW'}
          </button>
        ))}
      </div>

      {/* Контент по табу */}
      {tab === 'list' && (
        <div className="card-stagger-3">
          {/* Поиск */}
          <input className="input" placeholder="🔍 Search..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadJobs()}
            style={{ marginBottom: '10px' }} />

          {/* Категории */}
          <div className="filter-row" style={{ overflowX: 'auto', paddingBottom: '4px', flexWrap: 'nowrap' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`fb ${category === c ? 'fb-on' : 'fb-off'}`}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {c}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', fontSize: '24px' }}>⏳</div>
          ) : jobs.length === 0 ? (
            <GlassCard style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ fontSize: '24px' }}>📭</div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>No jobs found</div>
            </GlassCard>
          ) : (
            jobs.map(j => (
              <GlassCard key={j.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '8px', color: '#fff', flex: 1, marginRight: '8px', lineHeight: 1.5 }}>
                    {j.title.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '8px', color: '#ffaa00', flexShrink: 0 }}>
                    {j.budget_min ? `$${j.budget_min}` : ''}{j.budget_max ? `—$${j.budget_max}` : ''}
                  </span>
                </div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', lineHeight: 1.6 }}>
                  {(j.description || '').slice(0, 80)}...
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '6px', padding: '3px 7px', borderRadius: '4px',
                      background: 'rgba(255,136,0,0.12)',
                      border: '1px solid rgba(255,136,0,0.35)', color: '#ff8800',
                    }}>
                      {j.category || 'general'}
                    </span>
                    <span style={{ fontSize: '6px', color: 'rgba(255,255,255,0.3)' }}>
                      {j.applications_count} apps.
                    </span>
                  </div>
                  <button className="btn btn-g" style={{ fontSize: '7px', padding: '6px 12px', margin: 0, width: 'auto' }}
                    onClick={() =>
                      jobsApi.apply(j.id, {})
                        .then(() => { tg?.HapticFeedback?.notificationOccurred('success'); toast.success('Application sent!'); })
                        .catch((e: any) => toast.error(e.response?.data?.error || 'Error'))
                    }>
                    📨 APPLY
                  </button>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}

      {tab === 'my' && (
        <div className="card-stagger-3">
          <MyJobs />
        </div>
      )}

      {tab === 'create' && (
        <div className="card-stagger-3">
          <GlassCard>
            {[
              { label: 'Title *', key: 'title', placeholder: 'Website development...' },
              { label: 'Description *', key: 'description', placeholder: 'Detailed description...', multi: true },
              { label: 'Budget from ($)', key: 'budget_min', placeholder: '50', type: 'number' },
              { label: 'Budget to ($)', key: 'budget_max', placeholder: '500', type: 'number' },
              { label: 'Deadline (days)', key: 'deadline', placeholder: '7', type: 'number' },
              { label: 'Skills (comma separated)', key: 'skills_required', placeholder: 'React, Node.js...' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>{field.label}</div>
                {field.multi ? (
                  <textarea className="input" placeholder={field.placeholder}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    style={{ minHeight: '70px', resize: 'vertical' }} />
                ) : (
                  <input className="input" placeholder={field.placeholder} type={field.type || 'text'}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
                )}
              </div>
            ))}
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Category</div>
            <select className="input" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              style={{ marginBottom: '0' }}>
              {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </GlassCard>

          <button className="btn btn-y btn-full" style={{ marginTop: '10px' }} onClick={handleCreate}>
            [ 📌 PUBLISH JOB ]
          </button>
        </div>
      )}
    </div>
  );
}
