import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { GlassCard } from '../components/GlassCard';
import { contracts } from '../utils/api';
import toast from 'react-hot-toast';

// ============================================================
// Экран 02: NEW DEAL — создание контракта, 5 шагов
// ============================================================

interface Criterion { text: string; required: boolean; }

const STEPS = ['Название', 'Описание', 'Сумма', 'Дедлайн', 'Критерии'];

export function NewDeal() {
  const navigate = useNavigate();
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await contracts.create({
        title, description,
        amount_usd: Number(amountUsd),
        currency, deadline,
        criteria: criteria.filter(c => c.text.trim()),
      });
      toast.success('Сделка создана!');
      navigate(`/deal/${res.data.contractId}`, { state: { inviteUrl: res.data.inviteUrl } });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="new_deal" width={320} height={100} />

      <div style={{ textAlign: 'center', margin: '12px 0 16px' }}>
        <h1 style={{ fontSize: '11px', color: '#FFAA00' }}>НОВЫЙ КВЕСТ</h1>
      </div>

      {/* Прогресс-бар шагов */}
      <div className="steps" style={{ marginBottom: '20px' }}>
        {STEPS.map((s, i) => (
          <div key={i} className={`step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`} />
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
        ШАГ {step + 1}: {STEPS[step].toUpperCase()}
      </div>

      <GlassCard>
        {/* Шаг 0: Название */}
        {step === 0 && (
          <div>
            <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>
              Название сделки
            </label>
            <input className="input" placeholder="Разработка лендинга..." value={title}
              onChange={e => setTitle(e.target.value)} maxLength={256} />
          </div>
        )}

        {/* Шаг 1: Описание */}
        {step === 1 && (
          <div>
            <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>
              Описание задачи
            </label>
            <textarea className="input" placeholder="Подробно опиши что нужно сделать..." value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ minHeight: '100px', resize: 'vertical' }} />
          </div>
        )}

        {/* Шаг 2: Сумма и валюта */}
        {step === 2 && (
          <div>
            <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>
              Сумма (макс. $500)
            </label>
            <input className="input" type="number" placeholder="100" value={amountUsd}
              onChange={e => setAmountUsd(e.target.value)} min="1" max="500"
              style={{ marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['TON', 'USDT'] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`btn btn-full ${currency === c ? 'btn-green' : 'btn-ghost'}`}>
                  {c === 'TON' ? '💎 TON' : '💵 USDT'}
                </button>
              ))}
            </div>
            {Number(amountUsd) > 0 && (
              <div style={{ marginTop: '10px', fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>
                Комиссия платформы: <span style={{ color: '#FFAA00' }}>2%</span> = ${(Number(amountUsd) * 0.02).toFixed(2)}
              </div>
            )}
          </div>
        )}

        {/* Шаг 3: Дедлайн */}
        {step === 3 && (
          <div>
            <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>
              Дедлайн
            </label>
            <input className="input" type="date" value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} />
          </div>
        )}

        {/* Шаг 4: Критерии приёмки */}
        {step === 4 && (
          <div>
            <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>
              Критерии приёмки (мин. 3)
            </label>
            {criteria.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ color: '#00FF88', fontSize: '9px', minWidth: '16px' }}>{i + 1}.</span>
                <input className="input" placeholder={`Критерий ${i + 1}...`} value={c.text}
                  onChange={e => {
                    const next = [...criteria];
                    next[i] = { ...next[i], text: e.target.value };
                    setCriteria(next);
                  }} />
              </div>
            ))}
            <button className="btn btn-ghost btn-full" style={{ marginTop: '8px' }}
              onClick={() => setCriteria([...criteria, { text: '', required: false }])}>
              + Добавить критерий
            </button>
          </div>
        )}
      </GlassCard>

      {/* Навигация */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {step > 0 && (
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>
            ◀ НАЗАД
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="btn btn-green" style={{ flex: 2 }}
            onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
            ДАЛЕЕ ▶
          </button>
        ) : (
          <button className="btn btn-gold" style={{ flex: 2 }}
            onClick={handleSubmit} disabled={!canNext() || loading}>
            {loading ? '⏳ СОЗДАЁМ...' : '⚔️ СОЗДАТЬ СДЕЛКУ'}
          </button>
        )}
      </div>
    </div>
  );
}
