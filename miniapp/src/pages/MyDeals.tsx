import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusPill } from '../components/GlassCard';
import { users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';

// ============================================================
// Page: MY DEALS — all user deals in both roles
// ============================================================

const STATUS_COLORS: Record<string, string> = {
  draft              : 'rgba(255,255,255,0.3)',
  pending_signature  : '#ffaa00',
  signed             : '#0088ff',
  awaiting_payment   : '#ff8800',
  in_progress        : '#0088ff',
  under_review       : '#cc44ff',
  completed          : '#00ff88',
  disputed           : '#ff4466',
  refunded           : '#ff8800',
};

function DealCard({ deal, role, onClick }: { deal: any; role: 'client' | 'freelancer'; onClick: () => void }) {
  const deadline = new Date(deal.deadline).toLocaleDateString('en-US');
  const color = STATUS_COLORS[deal.status] || 'rgba(255,255,255,0.3)';

  return (
    <div
      className="gl dc"
      style={{ borderColor: `${color}44`, cursor: 'pointer', marginBottom: '8px' }}
      onClick={onClick}
    >
      <div className="pxgrid" /><div className="sh" />

      {/* Title + role */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: '9px', color: '#fff', flex: 1, marginRight: '8px', lineHeight: 1.6 }}>
          {deal.title?.toUpperCase()}
        </div>
        <span style={{
          fontSize: '6px', padding: '3px 7px',
          borderRadius: '4px', flexShrink: 0,
          background: role === 'client' ? 'rgba(0,255,136,0.12)' : 'rgba(0,136,255,0.12)',
          border: `1px solid ${role === 'client' ? 'rgba(0,255,136,0.35)' : 'rgba(0,136,255,0.35)'}`,
          color: role === 'client' ? '#00ff88' : '#0088ff',
        }}>
          {role === 'client' ? 'CLIENT' : 'FREELANCER'}
        </span>
      </div>

      {/* Status + amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <StatusPill status={deal.status} />
        <span style={{ fontSize: '8px', color: '#ffaa00' }}>
          ${deal.amount_usd} {deal.currency}
        </span>
      </div>

      {/* Deadline */}
      <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.25)', marginTop: '6px', position: 'relative', zIndex: 2 }}>
        📅 {deadline}
      </div>
    </div>
  );
}

export function MyDeals() {
  const navigate = useNavigate();
  const { tg }   = useTelegram();
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'all' | 'client' | 'freelancer'>('all');

  useEffect(() => {
    usersApi.myDeals()
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const go = (id: string) => {
    tg?.HapticFeedback?.selectionChanged();
    navigate(`/deal/${id}`);
  };

  const switchTab = (t: typeof tab) => {
    tg?.HapticFeedback?.selectionChanged();
    setTab(t);
  };

  const allDeals      = data ? [...(data.as_client || []), ...(data.as_freelancer || [])] : [];
  const clientDeals   = data?.as_client || [];
  const freelancerDeals = data?.as_freelancer || [];
  const shown = tab === 'all' ? allDeals : tab === 'client' ? clientDeals : freelancerDeals;
  const activeCount = allDeals.filter(d => !['completed','refunded','cancelled'].includes(d.status)).length;

  if (loading) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '36px', animation: 'float 2s ease-in-out infinite' }}>⚔️</div>
      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginTop: '16px' }}>LOADING...</div>
    </div>
  );

  return (
    <div className="page fade-in">

      {/* Header */}
      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(0,255,136,0.3)' }}>
        <div className="pxgrid" /><div className="sh" />
        <div>
          <div className="logo" style={{ fontSize: '11px' }}>⚔️ MY DEALS</div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
            {activeCount > 0 ? `${activeCount} active` : 'no active deals'}
          </div>
        </div>
        <button className="btn btn-g" style={{ width: 'auto', padding: '8px 14px', margin: 0, fontSize: '8px' }}
          onClick={() => { tg?.HapticFeedback?.impactOccurred('medium'); navigate('/new-deal'); }}>
          + NEW
        </button>
      </div>

      {/* Tabs */}
      <div className="filter-row card-stagger-2">
        {(['all', 'client', 'freelancer'] as const).map(t => (
          <button key={t} onClick={() => switchTab(t)}
            className={`fb ${tab === t ? 'fb-on' : 'fb-off'}`}>
            {t === 'all' ? `ALL (${allDeals.length})` : t === 'client' ? `CLIENT (${clientDeals.length})` : `FREELANCER (${freelancerDeals.length})`}
          </button>
        ))}
      </div>

      {/* Deals list */}
      <div className="card-stagger-3">
        {shown.length === 0 ? (
          <div className="gl dc" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '32px', marginBottom: '10px', animation: 'float 3s ease-in-out infinite' }}>🏰</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', lineHeight: 2 }}>
              {tab === 'client' ? 'NO CREATED DEALS' :
               tab === 'freelancer' ? 'NO ACCEPTED DEALS' :
               'NO DEALS'}
            </div>
            <button className="btn btn-y" style={{ marginTop: '14px' }}
              onClick={() => navigate('/new-deal')}>
              [ ⚔️ CREATE FIRST ]
            </button>
          </div>
        ) : (
          shown.map((deal: any) => (
            <DealCard
              key={`${deal.role}-${deal.contract_id}`}
              deal={deal}
              role={deal.role}
              onClick={() => go(deal.contract_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
