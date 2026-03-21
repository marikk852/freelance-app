import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { GlassCard } from '../components/GlassCard';
import { deliveries as deliveriesApi } from '../utils/api';
import toast from 'react-hot-toast';

// ============================================================
// Экран 05: REVIEW — чек-лист критериев, превью файлов
// ============================================================

export function Review() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [delivery, setDelivery] = useState<any>(null);
  const [checked,  setChecked]  = useState<Record<number, boolean>>({});
  const [rejectComment, setRejectComment] = useState('');
  const [mode,    setMode]    = useState<'review'|'reject'>('review');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // В реальном приложении получаем delivery по contract_id
    // Здесь используем моковые данные для демо
  }, [id]);

  const allChecked = delivery?.criteria?.every((_: any, i: number) => checked[i]);

  const handleApprove = async () => {
    if (!delivery) return;
    setLoading(true);
    try {
      await deliveriesApi.approve(delivery.id);
      toast.success('🎉 Работа принята! Деньги отправлены фрилансеру.');
      navigate(`/deal/${id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Ошибка');
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!delivery || !rejectComment.trim()) return toast.error('Напиши комментарий');
    setLoading(true);
    try {
      await deliveriesApi.reject(delivery.id, rejectComment);
      toast.success('Отправлено на доработку');
      navigate(`/deal/${id}`);
    } catch { toast.error('Ошибка'); } finally { setLoading(false); }
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="review" width={320} height={110} />

      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <h1 style={{ fontSize: '11px', color: '#CC44FF' }}>🔍 ПРОВЕРКА РАБОТЫ</h1>
      </div>

      {!delivery ? (
        <GlassCard style={{ textAlign: 'center', padding: '32px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>
            Работа ещё не сдана.<br/>Ожидайте уведомления.
          </div>
        </GlassCard>
      ) : (
        <>
          {/* Превью файлов */}
          {delivery.files?.length > 0 && (
            <GlassCard>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>📎 ФАЙЛЫ</div>
              {delivery.files.map((f: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '8px' }}>{f.originalName}</span>
                  <a href={deliveriesApi.previewUrl(f.fileId)} target="_blank" rel="noreferrer"
                    style={{ fontSize: '7px', color: '#0088FF', textDecoration: 'none' }}>
                    👁 Превью
                  </a>
                </div>
              ))}
            </GlassCard>
          )}

          {/* Чек-лист */}
          <GlassCard>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>
              ✅ ЧЕК-ЛИСТ КРИТЕРИЕВ
            </div>
            {delivery.criteria?.map((c: string, i: number) => (
              <label key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start',
                marginBottom: '10px', cursor: 'pointer' }}>
                <div onClick={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                  style={{ width: '16px', height: '16px', minWidth: '16px',
                    background: checked[i] ? '#00FF88' : 'rgba(255,255,255,0.1)',
                    border: `1px solid ${checked[i] ? '#00FF88' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', cursor: 'pointer' }}>
                  {checked[i] ? '✓' : ''}
                </div>
                <span style={{ fontSize: '8px', color: checked[i] ? '#fff' : 'rgba(255,255,255,0.5)' }}>{c}</span>
              </label>
            ))}
          </GlassCard>

          {/* Режим отклонения */}
          {mode === 'reject' && (
            <GlassCard>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                Комментарий для фрилансера:
              </div>
              <textarea className="input" value={rejectComment}
                onChange={e => setRejectComment(e.target.value)}
                placeholder="Что именно нужно исправить..."
                style={{ minHeight: '80px', resize: 'vertical' }} />
            </GlassCard>
          )}

          {/* Кнопки действий */}
          {mode === 'review' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="btn btn-green btn-full" onClick={handleApprove}
                disabled={!allChecked || loading}>
                {loading ? '⏳' : '✅ ПРИНЯТЬ РАБОТУ'}
              </button>
              <button className="btn btn-ghost btn-full" onClick={() => setMode('reject')}>
                🔄 НУЖНЫ ПРАВКИ
              </button>
              <button className="btn btn-red btn-full" onClick={() => navigate(`/dispute/${id}`)}>
                ⚖️ ОТКРЫТЬ СПОР
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setMode('review')}>
                ◀ НАЗАД
              </button>
              <button className="btn btn-orange" style={{ flex: 2, background: '#FF8800', color: '#000' }}
                onClick={handleReject} disabled={loading}>
                📤 ОТПРАВИТЬ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
