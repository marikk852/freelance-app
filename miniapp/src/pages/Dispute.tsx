import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { disputes as disputesApi, contracts as contractsApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Screen 06: DISPUTE — opening a dispute, evidence
// ============================================================

export function Dispute() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tg }   = useTelegram();
  const [reason,       setReason]       = useState('');
  const [evidence,     setEvidence]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [existingDispute, setExistingDispute] = useState<any>(null);
  const [checkingStatus,  setCheckingStatus]  = useState(true);

  useEffect(() => {
    if (!id) return;
    // Check if there's already an active dispute
    contractsApi.get(id)
      .then(r => {
        if (r.data.status === 'disputed') {
          return disputesApi.byContract(id).then(d => setExistingDispute(d.data));
        }
      })
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!reason.trim()) return toast.error('Describe the reason for the dispute');
    tg?.HapticFeedback?.impactOccurred('heavy');
    setLoading(true);
    try {
      await disputesApi.open({
        contractId: id,
        reason,
        evidence: evidence ? [{ type: 'text', content: evidence }] : [],
      });
      setSubmitted(true);
      tg?.HapticFeedback?.notificationOccurred('warning');
      toast.success('Dispute opened. Arbitrator will review within 24 hours.');
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Error');
    } finally { setLoading(false); }
  };

  if (checkingStatus) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '60px' }}>
      <div style={{ fontSize: '28px', animation: 'float 2s ease-in-out infinite' }}>⚖️</div>
      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginTop: '12px' }}>LOADING...</div>
    </div>
  );

  return (
    <div className="page fade-in">
      <PixelScene scene="dispute" width={252} height={56} />

      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(255,68,102,0.3)' }}>
        <div className="pxgrid" /><div className="sh" />
        <div className="logo" style={{ color: '#ff4466' }}>⚖️ DISPUTE</div>
      </div>

      {/* Already disputed — show existing dispute info */}
      {existingDispute && (
        <div className="gl dc card-stagger-2" style={{
          textAlign: 'center', padding: '24px 16px',
          borderColor: 'rgba(255,68,102,0.3)', background: 'rgba(255,68,102,0.04)',
        }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '28px', marginBottom: '10px', animation: 'float 3s ease-in-out infinite' }}>⚖️</div>
          <div style={{ fontSize: '9px', color: '#ff4466', marginBottom: '10px' }}>DISPUTE OPEN</div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', lineHeight: '2', textAlign: 'left',
            padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.08)', marginBottom: '10px' }}>
            "{existingDispute.reason}"
          </div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', lineHeight: '2.2' }}>
            Status: <span style={{ color: existingDispute.status === 'resolved' ? '#00ff88' : '#ffaa00' }}>
              {existingDispute.status?.toUpperCase()}
            </span><br/>
            {existingDispute.decision && (
              <span>Decision: <span style={{ color: '#00ff88' }}>{existingDispute.decision?.replace(/_/g, ' ').toUpperCase()}</span></span>
            )}
          </div>
          <button className="btn btn-gr btn-full" style={{ marginTop: '14px' }}
            onClick={() => navigate(`/deal/${id}`)}>
            [ ◀ BACK TO DEAL ]
          </button>
        </div>
      )}

      {!existingDispute && (submitted ? (
        <div className="gl dc card-stagger-2" style={{
          textAlign: 'center', padding: '32px 20px',
          borderColor: 'rgba(204,68,255,0.3)', background: 'rgba(204,68,255,0.04)',
        }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '36px', marginBottom: '14px', animation: 'float 3s ease-in-out infinite' }}>⚖️</div>
          <div style={{ fontSize: '10px', color: '#cc44ff', marginBottom: '10px' }}>DISPUTE OPENED</div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.45)', lineHeight: '2.2' }}>
            The arbitrator will review the situation<br/>within 24 hours.<br/>
            Funds are frozen until a decision is made.
          </div>
          <button className="btn btn-gr btn-full" style={{ marginTop: '20px' }}
            onClick={() => navigate(`/deal/${id}`)}>
            [ ◀ BACK TO DEAL ]
          </button>
        </div>
      ) : (
        <>
          {/* Warning */}
          <div className="gl card-stagger-2" style={{ borderColor: 'rgba(255,68,102,0.25)', background: 'rgba(255,68,102,0.04)' }}>
            <div className="pxgrid" />
            <div style={{ fontSize: '8px', color: '#ff4466', marginBottom: '6px' }}>⚠️ IMPORTANT</div>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.45)', lineHeight: '2.2' }}>
              Funds remain frozen until the arbitrator's decision.<br/>
              The arbitrator will review evidence from both parties.
            </div>
          </div>

          {/* Form */}
          <div className="gl card-stagger-3">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              DISPUTE REASON *
            </div>
            <textarea className="input" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Describe the situation in detail..."
              style={{ minHeight: '90px', resize: 'vertical', marginBottom: '14px' }} />

            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              EVIDENCE (OPTIONAL)
            </div>
            <textarea className="input" value={evidence} onChange={e => setEvidence(e.target.value)}
              placeholder="Links, description, screenshots..."
              style={{ minHeight: '60px', resize: 'vertical' }} />
          </div>

          <div className="card-stagger-4" style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-gr" style={{ flex: 1 }} onClick={() => navigate(-1)}>
              ◀ BACK
            </button>
            <button className="btn btn-r" style={{ flex: 2 }}
              onClick={handleSubmit} disabled={loading || !reason.trim()}>
              {loading ? '[ ⏳ ]' : '[ ⚖️ OPEN DISPUTE ]'}
            </button>
          </div>
        </>
      ))}
    </div>
  );
}
