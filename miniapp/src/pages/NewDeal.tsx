import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { contracts } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

interface Criterion { text: string; required: boolean; }

const STEPS = ['НАЗВАНИЕ', 'ОПИСАНИЕ', 'СУММА', 'ДЕДЛАЙН', 'КРИТЕРИИ'];

export function NewDeal() {
  const navigate = useNavigate();
  const { tg } = useTelegram();
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [amountUsd,   setAmountUsd]   = useState('');
  const [currency,    setCurrency]    = useState<'TON'|'USDT'>('USDT');
  const [deadline,    setDeadline]    = useState('');
  const [criteria,    setCriteria]    = useState<Criterion[]>([
    { text: '', required: true },
    { text: '', required: true },
    { text: '', required: true },
  ]);

  const canNext = () => {
    if (step === 0) return title.trim().length >= 3;
    if (step === 1) return description.trim().length >= 10;
    if (step === 2) return Number(amountUsd) > 0 && Number(amountUsd) <= 500;
    if (step === 3) return !!deadline && new Date(deadline) > new Date();
    if (step === 4) return criteria.filter(c => c.text.trim()).length >= 3;
    return true;
  };

  const goNext = () => {
    tg?.HapticFeedback?.selectionChanged();
    setStep(s => s + 1);
  };
  const goBack = () => {
    tg?.HapticFeedback?.selectionChanged();
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    tg?.HapticFeedback?.impactOccurred('medium');
    setLoading(true);
    try {
      const res = await contracts.create({
        title, description,
        amount_usd: Number(amountUsd),
        currency, deadline,
        criteria: criteria.filter(c => c.text.trim()),
      });
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Сделка создана!');
      navigate(`/deal/${res.data.contractId}`, { state: { inviteUrl: res.data.inviteUrl } });
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="new_deal" width={252} height={56} />

      <div className="sec card-stagger-1">⚔ НОВЫЙ КВЕСТ</div>

      {/* Прогресс шагов */}
      <div className="gl card-stagger-2" style={{ padding: '12px 16px' }}>
        <div className="pxgrid" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{
              width: '28px', height: '28px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '8px',
              background: i < step ? 'rgba(0,255,136,0.2)' : i === step ? 'rgba(255,170,0,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${i < step ? 'rgba(0,255,136,0.5)' : i === step ? 'rgba(255,170,0,0.6)' : 'rgba(255,255,255,0.1)'}`,
              color: i < step ? '#00ff88' : i === step ? '#ffaa00' : 'rgba(255,255,255,0.3)',
              transition: 'all 0.3s',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
          ))}
        </div>
        <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(step / (STEPS.length - 1)) * 100}%`,
            background: 'linear-gradient(90deg,#ffaa00,#ff6600)',
            transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
          }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
          ШАГ {step + 1}/5 — {STEPS[step]}
        </div>
      </div>

      {/* Контент шага */}
      <div className="gl card-stagger-3">
        <div className="pxgrid" /><div className="sh" />

        {step === 0 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              НАЗВАНИЕ СДЕЛКИ
            </div>
            <input className="input" placeholder="Разработка лендинга..." value={title}
              onChange={e => setTitle(e.target.value)} maxLength={256} />
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
              Мин. 3 символа · {title.length}/256
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              ОПИСАНИЕ ЗАДАЧИ
            </div>
            <textarea className="input" placeholder="Подробно опиши что нужно сделать..." value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ minHeight: '100px', resize: 'vertical' }} />
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
              Мин. 10 символов · {description.length} введено
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              СУММА (МАКС. $500)
            </div>
            <input className="input" type="number" placeholder="100" value={amountUsd}
              onChange={e => setAmountUsd(e.target.value)} min="1" max="500"
              style={{ marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {(['TON', 'USDT'] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`btn btn-full ${currency === c ? 'btn-b' : 'btn-gr'}`}>
                  {c === 'TON' ? '💎 TON' : '💵 USDT'}
                </button>
              ))}
            </div>
            {Number(amountUsd) > 0 && (
              <div className="fee">
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Комиссия 2%</span>
                <span style={{ color: '#ffaa00' }}>-${(Number(amountUsd) * 0.02).toFixed(2)}</span>
              </div>
            )}
            {Number(amountUsd) > 0 && (
              <div className="fee">
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Фрилансер получит</span>
                <span style={{ color: '#00ff88' }}>${(Number(amountUsd) * 0.98).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              ДЕДЛАЙН
            </div>
            <input className="input" type="date" value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} />
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>
              КРИТЕРИИ ПРИЁМКИ (МИН. 3)
            </div>
            {criteria.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{
                  color: c.text.trim() ? '#00ff88' : 'rgba(255,255,255,0.3)',
                  fontSize: '9px', minWidth: '18px', fontWeight: 'bold',
                }}>{i + 1}.</span>
                <input className="input" placeholder={`Критерий ${i + 1}...`} value={c.text}
                  onChange={e => {
                    const next = [...criteria];
                    next[i] = { ...next[i], text: e.target.value };
                    setCriteria(next);
                  }} style={{ margin: 0 }} />
              </div>
            ))}
            <button className="btn btn-gr btn-full" style={{ marginTop: '8px' }}
              onClick={() => setCriteria([...criteria, { text: '', required: false }])}>
              + ДОБАВИТЬ КРИТЕРИЙ
            </button>
          </div>
        )}
      </div>

      {/* Навигация */}
      <div className="card-stagger-4" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {step > 0 && (
          <button className="btn btn-gr" style={{ flex: 1 }} onClick={goBack}>
            ◀ НАЗАД
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className={`btn btn-g`} style={{ flex: 2 }}
            onClick={goNext} disabled={!canNext()}>
            ДАЛЕЕ ▶
          </button>
        ) : (
          <button className="btn btn-y" style={{ flex: 2 }}
            onClick={handleSubmit} disabled={!canNext() || loading}>
            {loading ? '[ ⏳ СОЗДАЁМ... ]' : '[ ⚔ СОЗДАТЬ СДЕЛКУ ]'}
          </button>
        )}
      </div>
    </div>
  );
}
