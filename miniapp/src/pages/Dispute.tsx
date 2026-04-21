import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { disputes as disputesApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Screen 06: DISPUTE — opening a dispute, evidence
// ============================================================

export function Dispute() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tg }   = useTelegram();
  const [reason,    setReason]    = useState('');
  const [evidence,  setEvidence]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  return (
    <div className="page fade-in">
      <PixelScene scene="dispute" width={252} height={56} />

      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(255,68,102,0.3)' }}>
        <div className="pxgrid" /><div className="sh" />
        <div className="logo" style={{ color: '#ff4466' }}>⚖️ DISPUTE</div>
      </div>

      {submitted ? (
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
      )}
    </div>
  );
}
