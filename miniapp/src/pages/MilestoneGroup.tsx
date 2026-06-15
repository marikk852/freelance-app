import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { contracts } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

const STATUS: Record<string, { label: string; color: string }> = {
  draft             : { label: 'LOCKED',         color: 'rgba(255,255,255,0.3)' },
  pending_signature : { label: 'AWAITING FREELANCER', color: '#ff8800' },
  signed            : { label: 'READY TO FUND',  color: '#ffaa00' },
  awaiting_payment  : { label: 'AWAITING PAYMENT', color: '#ffaa00' },
  in_progress       : { label: 'IN PROGRESS',    color: '#0088ff' },
  under_review      : { label: 'IN REVIEW',      color: '#cc44ff' },
  completed         : { label: 'DONE',           color: '#00ff88' },
  disputed          : { label: 'DISPUTED',       color: '#ff4466' },
  cancelled         : { label: 'CANCELLED',      color: '#ff4466' },
};

export function MilestoneGroup() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { tg } = useTelegram();
  const [data, setData] = useState<any>(null);
  const [err, setErr]   = useState(false);

  useEffect(() => {
    if (!tg?.BackButton) return;
    tg.BackButton.show();
    const back = () => navigate('/');
    tg.BackButton.onClick(back);
    return () => { tg.BackButton.offClick(back); tg.BackButton.hide(); };
  }, [tg, navigate]);

  useEffect(() => {
    if (!groupId) return;
    contracts.group(groupId).then(r => setData(r.data)).catch(() => setErr(true));
  }, [groupId]);

  if (err) return <div className="page fade-in"><div className="gl" style={{ padding: '24px', textAlign: 'center' }}><div className="px" style={{ fontSize: '8px', color: '#ff4466' }}>GROUP NOT FOUND</div></div></div>;
  if (!data) return <div className="page fade-in"><div className="px" style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px' }}>LOADING…</div></div>;

  const { group, stages } = data;
  const fundedCount = stages.filter((s: any) => s.status === 'completed').length;

  return (
    <div className="page fade-in">
      <PixelScene scene="deal_room" width={252} height={56} />
      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(204,68,255,0.3)', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <div className="pxgrid" /><div className="sh" />
        <div className="logo" style={{ color: '#cc44ff', textShadow: '0 0 10px rgba(204,68,255,0.7)', animation: 'none', fontSize: '10px' }}>🪜 MILESTONE DEAL</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#fff', textAlign: 'center' }}>{group.title}</div>
        <div className="px" style={{ fontSize: '8px', color: '#ffaa00' }}>${Number(group.total_usd).toLocaleString()} · {group.currency}</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{fundedCount}/{stages.length} stages done</div>
      </div>

      {/* Progress bar */}
      <div className="gl" style={{ padding: '12px 14px', marginBottom: '10px' }}>
        <div className="pxgrid" />
        <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ width: `${(fundedCount / stages.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#cc44ff,#00ff88)', transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Stages */}
      {stages.map((s: any) => {
        const meta = STATUS[s.status] || { label: s.status, color: 'var(--muted)' };
        const open = s.status !== 'draft';
        return (
          <div key={s.id} onClick={() => { if (open) navigate(`/deal/${s.id}`); }}
            className="gl-sm" style={{ marginBottom: '7px', padding: '12px', cursor: open ? 'pointer' : 'default', opacity: open ? 1 : 0.55, position: 'relative' }}>
            <div className="pxgrid" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="px" style={{ fontSize: '10px', color: meta.color }}>{s.milestone_idx + 1}</span>
                <div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#fff' }}>{s.title}</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#ffaa00' }}>${Number(s.amount_usd).toLocaleString()}</div>
                </div>
              </div>
              <span className="px" style={{ fontSize: '6px', color: meta.color, padding: '4px 7px', borderRadius: '6px', background: `${meta.color}1a`, border: `1px solid ${meta.color}55`, textAlign: 'right' }}>
                {s.status === 'draft' ? '🔒 ' : ''}{meta.label}
              </span>
            </div>
          </div>
        );
      })}

      <button className="btn btn-gr btn-full" style={{ fontSize: '7px', marginTop: '8px' }}
        onClick={() => { navigator.clipboard.writeText(window.location.origin); toast.success('Open a stage to share its invite'); }}>
        [ ℹ TAP A STAGE TO FUND / MANAGE IT ]
      </button>
    </div>
  );
}
