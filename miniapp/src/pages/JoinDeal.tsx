import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { StatusPill } from '../components/GlassCard';
import { rooms, contracts as contractsApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Join deal page via invite link
// Opened by the freelancer when they follow the ?room=UUID link
// ============================================================

export function JoinDeal() {
  const { link }   = useParams<{ link: string }>();
  const navigate   = useNavigate();
  const { tg }     = useTelegram();
  const [deal,     setDeal]    = useState<any>(null);
  const [loading,  setLoading] = useState(true);
  const [signing,  setSigning] = useState(false);

  useEffect(() => {
    if (!link) return;
    rooms.join(link)
      .then(r => { setDeal(r.data); setLoading(false); })
      .catch((e) => {
        console.error('[JoinDeal] Load error:', e?.response?.status, e?.response?.data || e?.message);
        setLoading(false);
      });
  }, [link]);

  const handleSign = async () => {
    if (!deal) return;
    tg?.HapticFeedback?.impactOccurred('medium');
    setSigning(true);
    try {
      await contractsApi.sign(deal.contract_id, 'freelancer');
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('You signed the contract!');
      navigate(`/deal/${deal.contract_id}`, { replace: true });
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Signing error');
    } finally {
      setSigning(false);
    }
  };

  const handleViewDeal = () => {
    if (!deal) return;
    navigate(`/deal/${deal.contract_id}`, { replace: true });
  };

  if (loading) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '36px', animation: 'float 2s ease-in-out infinite' }}>📜</div>
      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginTop: '16px' }}>
        LOADING DEAL...
      </div>
    </div>
  );

  if (!deal) return (
    <div className="page">
      <div className="gl" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div className="pxgrid" />
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>❓</div>
        <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', lineHeight: 2 }}>
          LINK IS INVALID<br/>OR DEAL IS CLOSED
        </div>
      </div>
      <button className="btn btn-gr" onClick={() => navigate('/')}>
        [ 🏠 HOME ]
      </button>
    </div>
  );

  const deadline = new Date(deal.deadline).toLocaleDateString('en-US');
  const alreadyJoined = deal.freelancer_id !== null;
  const closedStatuses = ['completed', 'refunded', 'cancelled'];
  const canSign = !alreadyJoined && !closedStatuses.includes(deal.status);

  return (
    <div className="page fade-in">
      <PixelScene scene="deal_room" width={252} height={56} />

      <div className="sec card-stagger-1">📜 DEAL INVITATION</div>

      {/* Карточка сделки */}
      <div className="gl card-stagger-2" style={{ borderColor: 'rgba(0,255,136,0.3)', background: 'rgba(0,255,136,0.03)' }}>
        <div className="pxgrid" /><div className="sh" />
        <div style={{ fontSize: '11px', color: '#fff', marginBottom: '10px', lineHeight: 1.6 }}>
          {deal.title?.toUpperCase()}
        </div>
        <div style={{ marginBottom: '8px' }}>
          <StatusPill status={deal.status} />
        </div>
        <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.35)', lineHeight: 2, marginBottom: '10px' }}>
          {deal.description}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginBottom: '6px' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>Amount</span>
          <span style={{ color: '#ffaa00' }}>${deal.amount_usd} {deal.currency}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginBottom: '6px' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>Deadline</span>
          <span style={{ color: '#fff' }}>{deadline}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>Client</span>
          <span style={{ color: '#0088ff' }}>
            {deal.client_username ? `@${deal.client_username}` : deal.client_first_name}
          </span>
        </div>
      </div>

      {/* Критерии приёмки */}
      {deal.criteria?.length > 0 && (
        <div className="gl card-stagger-3">
          <div className="pxgrid" />
          <div className="sec" style={{ margin: '0 0 8px', padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
            -- ACCEPTANCE CRITERIA --
          </div>
          {deal.criteria.map((c: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
              <span style={{ color: c.required ? '#ff4466' : '#ffaa00', fontSize: '8px', minWidth: '16px' }}>
                {c.required ? '★' : '○'}
              </span>
              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                {c.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Разбивка суммы */}
      <div className="gl card-stagger-4" style={{ padding: '10px 14px' }}>
        <div className="pxgrid" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', marginBottom: '6px' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>Deal amount</span>
          <span style={{ color: '#fff' }}>${deal.amount_usd}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', marginBottom: '6px' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>Platform fee</span>
          <span style={{ color: '#ff4466' }}>-${(deal.amount_usd * 0.02).toFixed(2)}</span>
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>YOU RECEIVE</span>
          <span style={{ color: '#00ff88' }}>${(deal.amount_usd * 0.98).toFixed(2)} {deal.currency}</span>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="card-stagger-5" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {canSign && (
          <button className="btn btn-g btn-full" onClick={handleSign} disabled={signing}>
            {signing ? '[ ⏳ SIGNING... ]' : '[ ✍️ ACCEPT DEAL ]'}
          </button>
        )}
        {alreadyJoined && (
          <>
            <div className="gl" style={{ textAlign: 'center', padding: '12px', borderColor: 'rgba(0,136,255,0.3)' }}>
              <div className="pxgrid" />
              <div style={{ fontSize: '8px', color: '#0088ff' }}>
                FREELANCER HAS ALREADY ACCEPTED THIS DEAL
              </div>
            </div>
            <button className="btn btn-b btn-full" onClick={handleViewDeal}>
              [ 🏰 OPEN ROOM ]
            </button>
          </>
        )}
        {!canSign && !alreadyJoined && (
          <div className="gl" style={{ textAlign: 'center', padding: '12px' }}>
            <div className="pxgrid" />
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)' }}>
              DEAL IS NOT AVAILABLE FOR JOINING
            </div>
          </div>
        )}
        <button className="btn btn-gr btn-full" onClick={() => navigate('/')}>
          [ 🏠 HOME ]
        </button>
      </div>
    </div>
  );
}
