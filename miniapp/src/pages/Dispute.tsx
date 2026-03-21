import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { GlassCard } from '../components/GlassCard';
import { disputes as disputesApi } from '../utils/api';
import toast from 'react-hot-toast';

// ============================================================
// Экран 06: DISPUTE — открытие спора, доказательства
// ============================================================

export function Dispute() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reason,    setReason]    = useState('');
  const [evidence,  setEvidence]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return toast.error('Опиши причину спора');
    setLoading(true);
    try {
      await disputesApi.open({
        contractId: id,
        reason,
        evidence: evidence ? [{ type: 'text', content: evidence }] : [],
      });
      setSubmitted(true);
      toast.success('Спор открыт. Арбитр рассмотрит в течение 24 часов.');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Ошибка');
    } finally { setLoading(false); }
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="dispute" width={320} height={110} />

      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <h1 style={{ fontSize: '11px', color: '#FF4466' }}>⚖️ СПОР</h1>
      </div>

      {submitted ? (
        <GlassCard style={{ textAlign: 'center', padding: '32px',
          background: 'rgba(204,68,255,0.06)', borderColor: 'rgba(204,68,255,0.2)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚖️</div>
          <div style={{ fontSize: '9px', color: '#CC44FF', marginBottom: '8px' }}>СПОР ОТКРЫТ</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: '2' }}>
            Арбитр рассмотрит ситуацию<br/>в течение 24 часов.<br/>
            Средства заморожены до решения.
          </div>
          <button className="btn btn-ghost btn-full" style={{ marginTop: '20px' }}
            onClick={() => navigate(`/deal/${id}`)}>
            ◀ К СДЕЛКЕ
          </button>
        </GlassCard>
      ) : (
        <>
          <GlassCard style={{ background: 'rgba(255,68,102,0.05)', borderColor: 'rgba(255,68,102,0.2)' }}>
            <div style={{ fontSize: '8px', color: '#FF4466', marginBottom: '6px' }}>⚠️ Важно</div>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', lineHeight: '2' }}>
              Средства остаются заморожены до решения арбитра.<br/>
              Арбитр изучит доказательства обеих сторон.
            </div>
          </GlassCard>

          <GlassCard>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              Причина спора *
            </div>
            <textarea className="input" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Опиши ситуацию подробно..."
              style={{ minHeight: '90px', resize: 'vertical', marginBottom: '14px' }} />

            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              Доказательства (необязательно)
            </div>
            <textarea className="input" value={evidence} onChange={e => setEvidence(e.target.value)}
              placeholder="Ссылки, описание, скриншоты..."
              style={{ minHeight: '60px', resize: 'vertical' }} />
          </GlassCard>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate(-1)}>
              ◀ НАЗАД
            </button>
            <button className="btn btn-red" style={{ flex: 2, background: '#FF4466', color: '#fff' }}
              onClick={handleSubmit} disabled={loading || !reason.trim()}>
              {loading ? '⏳' : '⚖️ ОТКРЫТЬ СПОР'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
