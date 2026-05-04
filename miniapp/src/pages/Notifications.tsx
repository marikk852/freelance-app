import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications as notificationsApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';

// ============================================================
// Push Notifications page — in-app notification centre
// ============================================================

const TYPE_ICON: Record<string, string> = {
  broadcast       : '📢',
  payment_received: '🔒',
  work_submitted  : '📦',
  work_approved   : '🎉',
  work_rejected   : '🔄',
  dispute_opened  : '⚖️',
  dispute_resolved: '✅',
  deadline_reminder:'⏰',
  welcome         : '👋',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

export function Notifications() {
  const navigate = useNavigate();
  const { tg }   = useTelegram();
  const [items,   setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsApi.list()
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleReadAll = async () => {
    tg?.HapticFeedback?.impactOccurred('light');
    await notificationsApi.readAll().catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleRead = async (id: string, payload: any) => {
    tg?.HapticFeedback?.selectionChanged();
    await notificationsApi.read(id).catch(() => {});
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (payload?.contractId) navigate(`/deal/${payload.contractId}`);
  };

  const unread = items.filter(n => !n.is_read).length;

  return (
    <div className="page fade-in">

      {/* Header */}
      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => navigate(-1)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '10px', padding: 0 }}>
              ◀
            </button>
            <div className="logo" style={{ color: '#cc44ff', fontSize: '9px' }}>
              NOTIFICATIONS
            </div>
          </div>
          {unread > 0 && (
            <button
              className="gl-pill"
              onClick={handleReadAll}
              style={{ fontSize: '7px', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)', background: 'none', cursor: 'pointer', padding: '3px 8px' }}>
              READ ALL ({unread})
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
          LOADING...
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="gl dc card-stagger-2" style={{ textAlign: 'center', padding: '36px 16px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'float 3s ease-in-out infinite' }}>🔔</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', lineHeight: 2.2 }}>
            NO NOTIFICATIONS YET
          </div>
        </div>
      )}

      {items.map((n, idx) => {
        const payload = typeof n.payload === 'string' ? JSON.parse(n.payload) : (n.payload || {});
        const icon    = TYPE_ICON[n.type] || '🔔';
        return (
          <div
            key={n.id}
            className={`gl card-stagger-${Math.min(idx + 2, 6)}`}
            onClick={() => handleRead(n.id, payload)}
            style={{
              cursor     : 'pointer',
              borderColor: n.is_read ? 'rgba(255,255,255,0.08)' : 'rgba(204,68,255,0.35)',
              background : n.is_read
                ? 'rgba(255,255,255,0.02)'
                : 'linear-gradient(135deg,rgba(0,0,0,0.7) 0%,rgba(204,68,255,0.05) 100%)',
              padding    : n.photo_url ? '0' : '12px 14px',
              overflow   : 'hidden',
            }}>
            <div className="pxgrid" /><div className="sh" />

            {/* Photo / GIF */}
            {n.photo_url && (
              <div style={{ position: 'relative' }}>
                <img
                  src={n.photo_url}
                  alt=""
                  style={{
                    width: '100%', maxHeight: '200px', objectFit: 'cover',
                    display: 'block',
                    borderRadius: '14px 14px 0 0',
                  }}
                />
                {!n.is_read && (
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#cc44ff', boxShadow: '0 0 8px #cc44ff',
                  }} />
                )}
              </div>
            )}

            <div style={{ padding: n.photo_url ? '12px 14px' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px' }}>{icon}</span>
                  {!n.is_read && (
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: '#cc44ff', boxShadow: '0 0 6px #cc44ff', flexShrink: 0,
                    }} />
                  )}
                </div>
                <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                  {timeAgo(n.created_at)}
                </span>
              </div>
              <div style={{
                fontSize: '8px',
                color: n.is_read ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)',
                lineHeight: '1.9',
                whiteSpace: 'pre-wrap',
              }}>
                {n.message}
              </div>
              {payload?.contractId && (
                <div style={{ marginTop: '8px', fontSize: '7px', color: '#0088ff' }}>
                  TAP TO OPEN DEAL →
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
