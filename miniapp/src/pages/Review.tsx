import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { deliveries as deliveriesApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Экран 05: REVIEW — чек-лист критериев, превью файлов
// ============================================================

export function Review() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { tg }    = useTelegram();
  const [delivery, setDelivery] = useState<any>(null);
  const [checked,  setChecked]  = useState<Record<number, boolean>>({});
  const [rejectComment, setRejectComment] = useState('');
  const [mode,    setMode]    = useState<'review'|'reject'>('review');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In production: fetch delivery by contract_id
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
      toast.success('🎉 Работа принята! Деньги отправлены фрилансеру.');
      navigate(`/deal/${id}`);
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Ошибка');
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    if (!delivery || !rejectComment.trim()) return toast.error('Напиши комментарий');
    tg?.HapticFeedback?.impactOccurred('medium');
    setLoading(true);
    try {
      await deliveriesApi.reject(delivery.id, rejectComment);
      tg?.HapticFeedback?.notificationOccurred('warning');
      toast.success('Отправлено на доработку');
      navigate(`/deal/${id}`);
    } catch { toast.error('Ошибка'); } finally { setLoading(false); }
  };

  const toggleCheck = (i: number) => {
    tg?.HapticFeedback?.selectionChanged();
    setChecked(prev => ({ ...prev, [i]: !prev[i] }));
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="review" width={252} height={56} />

      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div className="logo" style={{ color: '#cc44ff' }}>🔍 ПРОВЕРКА</div>
      </div>

      {!delivery ? (
        <div className="gl dc card-stagger-2" style={{ textAlign: 'center', padding: '32px 10px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '28px', marginBottom: '10px', animation: 'float 3s ease-in-out infinite' }}>📭</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', lineHeight: '2.2' }}>
            РАБОТА ЕЩЁ НЕ СДАНА<br/>ОЖИДАЙТЕ УВЕДОМЛЕНИЯ
          </div>
        </div>
      ) : (
        <>
          {/* Файлы */}
          {delivery.files?.length > 0 && (
            <div className="gl card-stagger-2">
              <div className="pxgrid" /><div className="sh" />
              <div className="sec" style={{ margin: '0 0 10px', padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
                -- 📎 ФАЙЛЫ --
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
                    👁 ПРЕВЬЮ
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Чек-лист */}
          <div className="gl card-stagger-3">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div className="sec" style={{ margin: 0, padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
                -- ЧЕК-ЛИСТ --
              </div>
              <span className="gl-pill" style={{
                fontSize: '7px', padding: '2px 8px',
                color: allChecked ? '#00ff88' : '#ffaa00',
                border: `1px solid ${allChecked ? 'rgba(0,255,136,0.4)' : 'rgba(255,170,0,0.4)'}`,
              }}>
                {checkedCount}/{totalCount}
              </span>
            </div>

            {/* Progress */}
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

          {/* Комментарий для отказа */}
          {mode === 'reject' && (
            <div className="gl card-stagger-4">
              <div className="pxgrid" /><div className="sh" />
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                КОММЕНТАРИЙ ДЛЯ ФРИЛАНСЕРА
              </div>
              <textarea className="input" value={rejectComment}
                onChange={e => setRejectComment(e.target.value)}
                placeholder="Что именно нужно исправить..."
                style={{ minHeight: '80px', resize: 'vertical' }} />
            </div>
          )}

          {/* Кнопки */}
          <div className="card-stagger-5" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {mode === 'review' ? (
              <>
                <button className="btn btn-g btn-full" onClick={handleApprove}
                  disabled={!allChecked || loading}>
                  {loading ? '[ ⏳ ]' : '[ ✅ ПРИНЯТЬ РАБОТУ ]'}
                </button>
                <button className="btn btn-gr btn-full" onClick={() => setMode('reject')}>
                  [ 🔄 НУЖНЫ ПРАВКИ ]
                </button>
                <button className="btn btn-r btn-full" onClick={() => navigate(`/dispute/${id}`)}>
                  [ ⚖️ ОТКРЫТЬ СПОР ]
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-gr" style={{ flex: 1 }} onClick={() => setMode('review')}>
                  ◀ НАЗАД
                </button>
                <button className="btn" style={{
                  flex: 2, background: 'linear-gradient(135deg,#ff8800,#ff6600)',
                  color: '#000', border: 'none',
                }} onClick={handleReject} disabled={loading}>
                  {loading ? '⏳' : '[ 📤 ОТПРАВИТЬ ]'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
