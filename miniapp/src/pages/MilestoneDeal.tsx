import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { contracts } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

type Stage = { title: string; amount: string; deadline: string; criteria: string[] };

const blankStage = (): Stage => ({ title: '', amount: '', deadline: '', criteria: ['', '', ''] });

export function MilestoneDeal() {
  const navigate = useNavigate();
  const { tg } = useTelegram();
  const [title, setTitle]     = useState('');
  const [currency, setCurrency] = useState<'TON' | 'USDT'>('USDT');
  const [stages, setStages]   = useState<Stage[]>([blankStage(), blankStage()]);
  const [loading, setLoading] = useState(false);

  const total = stages.reduce((s, st) => s + (Number(st.amount) || 0), 0);

  const setStage = (i: number, patch: Partial<Stage>) =>
    setStages(s => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));
  const setCriterion = (i: number, ci: number, val: string) =>
    setStages(s => s.map((st, j) => j === i ? { ...st, criteria: st.criteria.map((c, k) => k === ci ? val : c) } : st));

  const addStage    = () => stages.length < 10 && setStages(s => [...s, blankStage()]);
  const removeStage = (i: number) => stages.length > 2 && setStages(s => s.filter((_, j) => j !== i));

  const valid = () => {
    if (title.trim().length < 3) return false;
    if (total <= 10000) return false;
    return stages.every(st =>
      st.title.trim().length >= 3 &&
      Number(st.amount) > 0 && Number(st.amount) <= 10000 &&
      st.deadline && new Date(st.deadline) > new Date() &&
      st.criteria.filter(c => c.trim()).length >= 3
    );
  };

  const submit = async () => {
    if (!valid()) { toast.error('Fill all stages (≥3 criteria, ≤$10k each, total >$10k)'); return; }
    tg?.HapticFeedback?.impactOccurred('medium');
    setLoading(true);
    try {
      const res = await contracts.createMilestoneDeal({
        title, currency,
        milestones: stages.map(st => ({
          title: st.title, amount_usd: Number(st.amount), deadline: st.deadline,
          criteria: st.criteria.filter(c => c.trim()).map(c => ({ text: c, required: true })),
        })),
      });
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Milestone deal created!');
      navigate(`/group/${res.data.groupId}`);
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      if (e.response?.status === 403) { toast.error('Milestone deals are a PRO feature'); navigate('/subscription'); }
      else toast.error(e.response?.data?.error || 'Creation error');
    } finally { setLoading(false); }
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="new_deal" width={252} height={56} />
      <div className="sec card-stagger-1">🪜 MILESTONE DEAL <span style={{ color: '#cc44ff' }}>✦✦ PRO</span></div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px', lineHeight: 1.5 }}>
        For projects over $10,000 — split into stages (each ≤$10k). Funded and approved one stage at a time.
      </div>

      <div className="gl" style={{ marginBottom: '10px' }}>
        <div className="pxgrid" />
        <div className="px" style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>DEAL TITLE</div>
        <input className="input" placeholder="Full platform build…" value={title} onChange={e => setTitle(e.target.value)} />
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          {(['USDT', 'TON'] as const).map(c => (
            <button key={c} className="btn" style={{ flex: 1, fontSize: '8px', background: currency === c ? 'rgba(0,136,255,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${currency === c ? '#0088ff' : 'rgba(255,255,255,0.1)'}`, color: currency === c ? '#0088ff' : 'rgba(255,255,255,0.5)' }} onClick={() => setCurrency(c)}>{c}</button>
          ))}
        </div>
      </div>

      {stages.map((st, i) => (
        <div key={i} className="gl" style={{ marginBottom: '8px', borderColor: 'rgba(204,68,255,0.2)' }}>
          <div className="pxgrid" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="px" style={{ fontSize: '8px', color: '#cc44ff' }}>STAGE {i + 1}</span>
            {stages.length > 2 && <button onClick={() => removeStage(i)} style={{ background: 'none', border: 'none', color: '#ff4466', fontSize: '14px', cursor: 'pointer' }}>×</button>}
          </div>
          <input className="input" placeholder="Stage title…" value={st.title} onChange={e => setStage(i, { title: e.target.value })} style={{ marginBottom: '6px' }} />
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <input className="input" type="number" placeholder="Amount $ (≤10000)" value={st.amount} onChange={e => setStage(i, { amount: e.target.value })} style={{ flex: 1 }} />
            <input className="input" type="date" value={st.deadline} onChange={e => setStage(i, { deadline: e.target.value })} style={{ flex: 1 }} />
          </div>
          {st.criteria.map((c, ci) => (
            <input key={ci} className="input" placeholder={`Criterion ${ci + 1}`} value={c} onChange={e => setCriterion(i, ci, e.target.value)} style={{ marginBottom: '4px', fontSize: '12px' }} />
          ))}
          <button onClick={() => setStage(i, { criteria: [...st.criteria, ''] })} style={{ background: 'none', border: 'none', color: 'rgba(204,68,255,0.7)', fontSize: '10px', cursor: 'pointer', padding: '2px 0' }}>+ add criterion</button>
        </div>
      ))}

      {stages.length < 10 && (
        <button className="btn" style={{ fontSize: '8px', marginBottom: '8px', background: 'rgba(204,68,255,0.1)', border: '1px solid rgba(204,68,255,0.3)', color: '#cc44ff' }} onClick={addStage}>[ + ADD STAGE ]</button>
      )}

      <div className="gl" style={{ marginBottom: '8px', textAlign: 'center', padding: '10px' }}>
        <div className="pxgrid" />
        <span className="px" style={{ fontSize: '10px', color: total > 10000 ? '#00ff88' : '#ff8800' }}>TOTAL ${total.toLocaleString()}</span>
        {total <= 10000 && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: '#ff8800', marginTop: '4px' }}>Total must exceed $10,000</div>}
      </div>

      <button className="btn btn-y btn-full" onClick={submit} disabled={!valid() || loading}>
        {loading ? '[ ⏳ CREATING... ]' : '[ 🪜 CREATE MILESTONE DEAL ]'}
      </button>
    </div>
  );
}
