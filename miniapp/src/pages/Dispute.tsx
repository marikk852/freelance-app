import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { disputes as disputesApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Экран 06: DISPUTE — открытие спора, доказательства
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
    if (!reason.trim()) return toast.error('Опиши причину спора');
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
      toast.success('Спор открыт. Арбитр рассмотрит в течение 24 часов.');
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Ошибка');
    } finally { setLoading(false); }
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="dispute" width={252} height={56} />

      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(255,68,102,0.3)' }}>
        <div className="pxgrid" /><div className="sh" />
        <div className="logo" style={{ color: '#ff4466' }}>⚖️ СПОР</div>
      </div>

      {submitted ? (
        <div className="gl dc card-stagger-2" style={{
          textAlign: 'center', padding: '32px 20px',
          borderColor: 'rgba(204,68,255,0.3)', background: 'rgba(204,68,255,0.04)',
        }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '36px', marginBottom: '14px', animation: 'float 3s ease-in-out infinite' }}>⚖️</div>
          <div style={{ fontSize: '10px', color: '#cc44ff', marginBottom: '10px' }}>СПОР ОТКРЫТ</div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.45)', lineHeight: '2.2' }}>
            Арбитр рассмотрит ситуацию<br/>в течение 24 часов.<br/>
            Средства заморожены до решения.
          </div>
          <button className="btn btn-gr btn-full" style={{ marginTop: '20px' }}
            onClick={() => navigate(`/deal/${id}`)}>
            [ ◀ К СДЕЛКЕ ]
          </button>
        </div>
      ) : (
        <>
          {/* Предупреждение */}
          <div className="gl card-stagger-2" style={{ borderColor: 'rgba(255,68,102,0.25)', background: 'rgba(255,68,102,0.04)' }}>
            <div className="pxgrid" />
            <div style={{ fontSize: '8px', color: '#ff4466', marginBottom: '6px' }}>⚠️ ВАЖНО</div>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.45)', lineHeight: '2.2' }}>
              Средства остаются заморожены до решения арбитра.<br/>
              Арбитр изучит доказательства обеих сторон.
            </div>
          </div>

          {/* Форма */}
          <div className="gl card-stagger-3">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              ПРИЧИНА СПОРА *
            </div>
            <textarea className="input" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Опиши ситуацию подробно..."
              style={{ minHeight: '90px', resize: 'vertical', marginBottom: '14px' }} />

            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              ДОКАЗАТЕЛЬСТВА (НЕОБЯЗАТЕЛЬНО)
            </div>
            <textarea className="input" value={evidence} onChange={e => setEvidence(e.target.value)}
              placeholder="Ссылки, описание, скриншоты..."
              style={{ minHeight: '60px', resize: 'vertical' }} />
          </div>

          <div className="card-stagger-4" style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-gr" style={{ flex: 1 }} onClick={() => navigate(-1)}>
              ◀ НАЗАД
            </button>
            <button className="btn btn-r" style={{ flex: 2 }}
              onClick={handleSubmit} disabled={loading || !reason.trim()}>
              {loading ? '[ ⏳ ]' : '[ ⚖️ ОТКРЫТЬ СПОР ]'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
