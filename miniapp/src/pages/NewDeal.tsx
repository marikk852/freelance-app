import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { contracts, ai } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

interface Criterion { text: string; required: boolean; }

const STEPS = ['TITLE', 'DESCRIPTION', 'AMOUNT', 'DEADLINE', 'CRITERIA'];

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

  // AI помощник по заказу (PRO)
  const [aiOpen,     setAiOpen]     = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMsg[]>([]);
  const [aiInput,    setAiInput]    = useState('');
  const [aiBusy,     setAiBusy]     = useState(false);

  const sendAi = async () => {
    const text = aiInput.trim();
    if (!text || aiBusy) return;
    const history = [...aiMessages, { role: 'user' as const, content: text }];
    setAiMessages(history);
    setAiInput('');
    setAiBusy(true);
    try {
      const r = await ai.draftDeal(history);
      const { reply, ready, draft } = r.data;
      setAiMessages(h => [...h, { role: 'assistant', content: reply }]);
      if (ready && draft) applyDraft(draft);
    } catch (e: any) {
      if (e.response?.status === 403) {
        toast.error('AI assistant is a PRO feature');
        setAiOpen(false);
        navigate('/subscription');
      } else {
        toast.error(e.response?.data?.error || 'AI unavailable');
      }
    } finally {
      setAiBusy(false);
    }
  };

  const applyDraft = (d: any) => {
    if (d.title) setTitle(String(d.title).slice(0, 256));
    if (d.description) setDescription(String(d.description));
    if (d.budget_usd) setAmountUsd(String(d.budget_usd));
    if (Array.isArray(d.criteria) && d.criteria.length) {
      setCriteria(d.criteria.map((c: string) => ({ text: String(c), required: true })));
    }
    tg?.HapticFeedback?.notificationOccurred('success');
    toast.success('Draft applied — review and create');
    setAiOpen(false);
    setStep(0);
  };

  const canNext = () => {
    if (step === 0) return title.trim().length >= 3;
    if (step === 1) return description.trim().length >= 10;
    if (step === 2) return Number(amountUsd) > 0 && Number(amountUsd) <= 10000;
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
      toast.success('Deal created!');
      navigate(`/deal/${res.data.contractId}`, { state: { inviteUrl: res.data.inviteUrl } });
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Creation error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="new_deal" width={252} height={56} />

      <div className="sec card-stagger-1">⚔ NEW QUEST</div>

      {/* AI помощник по заказу (PRO) */}
      <button className="btn card-stagger-1" style={{
        fontSize: '8px', marginBottom: '8px',
        background: 'linear-gradient(175deg,#cc44ff,#8822bb)', color: '#fff',
        border: '1px solid #cc44ff', boxShadow: '0 0 14px rgba(204,68,255,0.35)',
      }} onClick={() => { setAiOpen(true); if (aiMessages.length === 0) setAiMessages([{ role: 'assistant', content: 'Describe your project in a few words — I\'ll turn it into a ready deal (title, criteria, budget). ✦✦ PRO' }]); }}>
        [ ✨ AI ASSISTANT — DRAFT MY DEAL ]
      </button>

      {/* Big project → milestone deal (PRO) */}
      <button className="btn card-stagger-1" style={{
        fontSize: '7px', marginBottom: '8px',
        background: 'rgba(204,68,255,0.1)', border: '1px solid rgba(204,68,255,0.3)', color: '#cc44ff',
      }} onClick={() => navigate('/new-milestone')}>
        [ 🪜 BIG PROJECT (&gt;$10K)? SPLIT INTO MILESTONES — PRO ]
      </button>

      {/* Step progress */}
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
          STEP {step + 1}/5 — {STEPS[step]}
        </div>
      </div>

      {/* Step content */}
      <div className="gl card-stagger-3">
        <div className="pxgrid" /><div className="sh" />

        {step === 0 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              DEAL TITLE
            </div>
            <input className="input" placeholder="Landing page development..." value={title}
              onChange={e => setTitle(e.target.value)} maxLength={256} />
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
              Min. 3 characters · {title.length}/256
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              TASK DESCRIPTION
            </div>
            <textarea className="input" placeholder="Describe in detail what needs to be done..." value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ minHeight: '100px', resize: 'vertical' }} />
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
              Min. 10 characters · {description.length} entered
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              AMOUNT (MAX. $500)
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
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Fee 2%</span>
                <span style={{ color: '#ffaa00' }}>-${(Number(amountUsd) * 0.02).toFixed(2)}</span>
              </div>
            )}
            {Number(amountUsd) > 0 && (
              <div className="fee">
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Freelancer receives</span>
                <span style={{ color: '#00ff88' }}>${(Number(amountUsd) * 0.98).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
              DEADLINE
            </div>
            <input className="input" type="date" value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} />
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>
              ACCEPTANCE CRITERIA (MIN. 3)
            </div>
            {criteria.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{
                  color: c.text.trim() ? '#00ff88' : 'rgba(255,255,255,0.3)',
                  fontSize: '9px', minWidth: '18px', fontWeight: 'bold',
                }}>{i + 1}.</span>
                <input className="input" placeholder={`Criterion ${i + 1}...`} value={c.text}
                  onChange={e => {
                    const next = [...criteria];
                    next[i] = { ...next[i], text: e.target.value };
                    setCriteria(next);
                  }} style={{ margin: 0 }} />
              </div>
            ))}
            <button className="btn btn-gr btn-full" style={{ marginTop: '8px' }}
              onClick={() => setCriteria([...criteria, { text: '', required: false }])}>
              + ADD CRITERION
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="card-stagger-4" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {step > 0 && (
          <button className="btn btn-gr" style={{ flex: 1 }} onClick={goBack}>
            ◀ BACK
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className={`btn btn-g`} style={{ flex: 2 }}
            onClick={goNext} disabled={!canNext()}>
            NEXT ▶
          </button>
        ) : (
          <button className="btn btn-y" style={{ flex: 2 }}
            onClick={handleSubmit} disabled={!canNext() || loading}>
            {loading ? '[ ⏳ CREATING... ]' : '[ ⚔ CREATE DEAL ]'}
          </button>
        )}
      </div>

      {/* AI chat modal — через портал в body, чтобы перекрыть глобальный BottomNav */}
      {aiOpen && createPortal((
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => setAiOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-dark2,#08080e)', borderTop: '1px solid rgba(204,68,255,0.4)',
            borderRadius: '18px 18px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 -8px 40px rgba(204,68,255,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="px" style={{ fontSize: '9px', color: '#cc44ff' }}>✨ AI ASSISTANT</span>
              <button onClick={() => setAiOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {aiMessages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{
                    fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: 1.5, padding: '9px 12px', borderRadius: '12px',
                    background: m.role === 'user' ? 'rgba(204,68,255,0.18)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${m.role === 'user' ? 'rgba(204,68,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                    color: m.role === 'user' ? '#fff' : 'rgba(255,255,255,0.85)',
                  }}>{m.content}</div>
                </div>
              ))}
              {aiBusy && <div className="px" style={{ fontSize: '7px', color: 'rgba(204,68,255,0.7)', alignSelf: 'flex-start' }}>⏳ THINKING…</div>}
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendAi(); }}
                placeholder="Describe your project…"
                style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontSize: '13px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none' }}
              />
              <button onClick={sendAi} disabled={aiBusy || !aiInput.trim()} style={{
                padding: '0 16px', borderRadius: '12px', border: 'none', cursor: aiBusy ? 'not-allowed' : 'pointer',
                background: aiInput.trim() && !aiBusy ? '#cc44ff' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '16px',
              }}>↑</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
