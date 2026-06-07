import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { deliveries as deliveriesApi, contracts as contractsApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Screen 05: REVIEW — freelancer submits / client reviews
// ============================================================

export function Review() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user, tg } = useTelegram();
  const [contract, setContract] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [checked,  setChecked]  = useState<Record<number, boolean>>({});
  const [rejectComment, setRejectComment] = useState('');
  const [mode,    setMode]    = useState<'review'|'reject'>('review');
  const [loading, setLoading] = useState(false);

  // Freelancer submit state
  const [description, setDescription] = useState('');
  const [links,       setLinks]       = useState('');
  const [files,       setFiles]       = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    contractsApi.get(id)
      .then(r => setContract(r.data))
      .catch(() => {});
    deliveriesApi.getByContractId(id)
      .then(r => {
        setDelivery(r.data);
        const initial: Record<number, boolean> = {};
        (r.data.criteria || []).forEach((_: any, i: number) => { initial[i] = false; });
        setChecked(initial);
      })
      .catch(() => setDelivery(null));
  }, [id]);

  const allChecked = delivery?.criteria?.every((_: any, i: number) => checked[i]);
  const checkedCount = delivery?.criteria?.filter((_: any, i: number) => checked[i]).length ?? 0;
  const totalCount   = delivery?.criteria?.length ?? 0;

  const handleApprove = async () => {
    if (!delivery) return;
    tg?.HapticFeedback?.impactOccurred('heavy');
    setLoading(true);
    try {
      await deliveriesApi.approve(delivery.id);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('🎉 Work accepted! Funds sent to the freelancer.');
      navigate(`/deal/${id}`);
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Error');
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!delivery || !rejectComment.trim()) return toast.error('Write a comment');
    tg?.HapticFeedback?.impactOccurred('medium');
    setLoading(true);
    try {
      await deliveriesApi.reject(delivery.id, rejectComment);
      tg?.HapticFeedback?.notificationOccurred('warning');
      toast.success('Sent for revision');
      navigate(`/deal/${id}`);
    } catch { toast.error('Error'); } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!description.trim()) return toast.error('Add a description');
    tg?.HapticFeedback?.impactOccurred('medium');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('contractId', id!);
      fd.append('description', description);
      if (links.trim()) fd.append('links', links);
      files.forEach(f => fd.append('files', f));
      await deliveriesApi.submit(fd);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Work submitted!');
      navigate(`/deal/${id}`);
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Error');
    } finally { setLoading(false); }
  };

  const toggleCheck = (i: number) => {
    tg?.HapticFeedback?.selectionChanged();
    setChecked(prev => ({ ...prev, [i]: !prev[i] }));
  };

  const isClient     = user && contract && Number(contract.client_tg_id)     === Number(user.id);
  const isFreelancer = user && contract && Number(contract.freelancer_tg_id) === Number(user.id);

  return (
    <div className="page fade-in">
      <PixelScene scene="review" width={252} height={56} />

      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div className="logo" style={{ color: '#cc44ff' }}>
          {isFreelancer && !delivery ? '📦 SUBMIT WORK'
            : isFreelancer && delivery?.status === 'rejected' ? '🔄 REVISION'
            : '🔍 REVIEW'}
        </div>
      </div>

      {/* ===== FREELANCER: submit form when no delivery yet ===== */}
      {isFreelancer && !delivery && (
        <>
          <div className="gl card-stagger-2">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
              -- DESCRIPTION --
            </div>
            <textarea
              className="input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what you've done..."
              style={{ minHeight: '90px', resize: 'vertical' }}
            />
          </div>

          <div className="gl card-stagger-3">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
              -- LINKS (optional) --
            </div>
            <input
              className="input"
              value={links}
              onChange={e => setLinks(e.target.value)}
              placeholder="https://github.com/... or other links"
            />
          </div>

          <div className="gl card-stagger-4">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>-- FILES --</div>
              <span className="gl-pill" style={{ fontSize: '7px', padding: '2px 8px', color: '#0088ff', border: '1px solid rgba(0,136,255,0.3)' }}>
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const picked = Array.from(e.target.files || []);
                setFiles(prev => [...prev, ...picked]);
              }}
            />
            {files.map((f, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 0',
                borderBottom: i < files.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                  {f.name}
                </span>
                <button
                  className="gl-pill"
                  onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  style={{ fontSize: '7px', color: '#ff4466', border: '1px solid rgba(255,68,102,0.35)', background: 'none', cursor: 'pointer', padding: '3px 8px' }}>
                  ✕
                </button>
              </div>
            ))}
            <button
              className="btn btn-gr btn-full"
              style={{ marginTop: files.length > 0 ? '10px' : '0' }}
              onClick={() => fileRef.current?.click()}>
              [ 📎 ADD FILES ]
            </button>
          </div>

          <div className="card-stagger-5">
            <button className="btn btn-g btn-full" onClick={handleSubmit} disabled={loading || !description.trim()}>
              {loading ? '[ ⏳ UPLOADING... ]' : '[ 📤 SUBMIT WORK ]'}
            </button>
          </div>
        </>
      )}

      {/* ===== FREELANCER: work rejected — show revision form ===== */}
      {isFreelancer && delivery?.status === 'rejected' && (
        <>
          {/* Rejection notice */}
          <div className="gl card-stagger-2" style={{ borderColor: 'rgba(255,68,102,0.35)', background: 'rgba(255,68,102,0.05)' }}>
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '8px', color: '#ff4466', marginBottom: '8px' }}>🔄 REVISION REQUESTED</div>
            {delivery.reviewComment && (
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.9', padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                "{delivery.reviewComment}"
              </div>
            )}
          </div>

          {/* Resubmit form */}
          <div className="gl card-stagger-3">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>-- NEW DESCRIPTION --</div>
            <textarea
              className="input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what was fixed..."
              style={{ minHeight: '90px', resize: 'vertical' }}
            />
          </div>

          <div className="gl card-stagger-4">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>-- LINKS (optional) --</div>
            <input className="input" value={links} onChange={e => setLinks(e.target.value)} placeholder="https://..." />
          </div>

          <div className="gl card-stagger-4">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>-- FILES --</div>
              <span className="gl-pill" style={{ fontSize: '7px', padding: '2px 8px', color: '#0088ff', border: '1px solid rgba(0,136,255,0.3)' }}>
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
            </div>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
              onChange={e => { const picked = Array.from(e.target.files || []); setFiles(prev => [...prev, ...picked]); }} />
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < files.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{f.name}</span>
                <button className="gl-pill" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ fontSize: '7px', color: '#ff4466', border: '1px solid rgba(255,68,102,0.35)', background: 'none', cursor: 'pointer', padding: '3px 8px' }}>✕</button>
              </div>
            ))}
            <button className="btn btn-gr btn-full" style={{ marginTop: files.length > 0 ? '10px' : '0' }} onClick={() => fileRef.current?.click()}>
              [ 📎 ADD FILES ]
            </button>
          </div>

          <div className="card-stagger-5">
            <button className="btn btn-y btn-full" onClick={handleSubmit} disabled={loading || !description.trim()}>
              {loading ? '[ ⏳ UPLOADING... ]' : '[ 📤 RESUBMIT WORK ]'}
            </button>
          </div>
        </>
      )}

      {/* ===== FREELANCER: work submitted, awaiting review ===== */}
      {isFreelancer && delivery && delivery.status === 'submitted' && (
        <div className="gl dc card-stagger-2" style={{ textAlign: 'center', padding: '32px 10px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '28px', marginBottom: '10px', animation: 'float 3s ease-in-out infinite' }}>⏳</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: '2.2' }}>
            WORK SUBMITTED<br/>WAITING FOR CLIENT REVIEW
          </div>
        </div>
      )}

      {/* ===== CLIENT: no delivery yet ===== */}
      {isClient && !delivery && (
        <div className="gl dc card-stagger-2" style={{ textAlign: 'center', padding: '32px 10px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '28px', marginBottom: '10px', animation: 'float 3s ease-in-out infinite' }}>📭</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: '2.2' }}>
            WORK NOT SUBMITTED YET<br/>WAIT FOR NOTIFICATION
          </div>
        </div>
      )}

      {/* ===== CLIENT: review delivery ===== */}
      {isClient && delivery && (
        <>
          {/* Files */}
          {delivery.files?.length > 0 && (
            <div className="gl card-stagger-2">
              <div className="pxgrid" /><div className="sh" />
              <div className="sec" style={{ margin: '0 0 10px', padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
                -- 📎 FILES --
              </div>
              {delivery.files.map((f: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < delivery.files.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.7)' }}>{f.originalName}</span>
                  <a href={deliveriesApi.previewUrl(f.fileId)} target="_blank" rel="noreferrer"
                    className="gl-pill"
                    style={{ fontSize: '7px', color: '#0088ff', textDecoration: 'none',
                      padding: '3px 8px', border: '1px solid rgba(0,136,255,0.35)' }}>
                    👁 PREVIEW
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          {delivery.description && (
            <div className="gl card-stagger-2">
              <div className="pxgrid" /><div className="sh" />
              <div className="sec" style={{ margin: '0 0 8px', padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
                -- DESCRIPTION --
              </div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.9' }}>
                {delivery.description}
              </div>
            </div>
          )}

          {/* Checklist */}
          <div className="gl card-stagger-3">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div className="sec" style={{ margin: 0, padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
                -- CHECKLIST --
              </div>
              <span className="gl-pill" style={{
                fontSize: '7px', padding: '2px 8px',
                color: allChecked ? '#00ff88' : '#ffaa00',
                border: `1px solid ${allChecked ? 'rgba(0,255,136,0.4)' : 'rgba(255,170,0,0.4)'}`,
              }}>
                {checkedCount}/{totalCount}
              </span>
            </div>

            <div className="hp-t" style={{ marginBottom: '12px' }}>
              <div className="hp-b" style={{
                '--hp': totalCount > 0 ? `${(checkedCount / totalCount) * 100}%` : '0%',
                background: allChecked
                  ? 'linear-gradient(90deg,#00ff88,#00cc55)'
                  : 'linear-gradient(90deg,#ffaa00,#ff8800)',
              } as any} />
            </div>

            {delivery.criteria?.map((c: string, i: number) => (
              <div key={i}
                onClick={() => toggleCheck(i)}
                style={{
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                  padding: '9px 0', cursor: 'pointer',
                  borderBottom: i < delivery.criteria.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                <div style={{
                  width: '18px', height: '18px', minWidth: '18px',
                  background: checked[i] ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${checked[i] ? '#00ff88' : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: '5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', color: '#00ff88',
                  transition: 'all 0.2s',
                  boxShadow: checked[i] ? '0 0 8px rgba(0,255,136,0.3)' : 'none',
                }}>
                  {checked[i] ? '✓' : ''}
                </div>
                <span style={{
                  fontSize: '8px',
                  color: checked[i] ? '#fff' : 'rgba(255,255,255,0.5)',
                  transition: 'color 0.2s',
                  lineHeight: '1.8',
                }}>{c}</span>
              </div>
            ))}
          </div>

          {/* Rejection comment */}
          {mode === 'reject' && (
            <div className="gl card-stagger-4">
              <div className="pxgrid" /><div className="sh" />
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                COMMENT FOR FREELANCER
              </div>
              <textarea className="input" value={rejectComment}
                onChange={e => setRejectComment(e.target.value)}
                placeholder="What exactly needs to be fixed..."
                style={{ minHeight: '80px', resize: 'vertical' }} />
            </div>
          )}

          {/* Buttons */}
          <div className="card-stagger-5" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {mode === 'review' ? (
              <>
                <button className="btn btn-g btn-full" onClick={handleApprove}
                  disabled={!allChecked || loading}>
                  {loading ? '[ ⏳ ]' : '[ ✅ ACCEPT WORK ]'}
                </button>
                <button className="btn btn-gr btn-full" onClick={() => setMode('reject')}>
                  [ 🔄 NEEDS REVISION ]
                </button>
                <button className="btn btn-r btn-full" onClick={() => navigate(`/dispute/${id}`)}>
                  [ ⚖️ OPEN DISPUTE ]
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-gr" style={{ flex: 1 }} onClick={() => setMode('review')}>
                  ◀ BACK
                </button>
                <button className="btn" style={{
                  flex: 2, background: 'linear-gradient(135deg,#ff8800,#ff6600)',
                  color: '#000', border: 'none',
                }} onClick={handleReject} disabled={loading}>
                  {loading ? '⏳' : '[ 📤 SEND ]'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
