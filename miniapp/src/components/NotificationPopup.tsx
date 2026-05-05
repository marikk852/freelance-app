import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications as notificationsApi } from '../utils/api';

// ============================================================
// Global in-app notification popup
// Shows the latest unread notification as a floating card
// ============================================================

interface NotifItem {
  id: string;
  type: string;
  message: string;
  photo_url: string | null;
  is_read: boolean;
  payload: any;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  broadcast        : '📢',
  payment_received : '🔒',
  work_submitted   : '📦',
  work_approved    : '🎉',
  work_rejected    : '🔄',
  dispute_opened   : '⚖️',
  dispute_resolved : '✅',
  deadline_reminder: '⏰',
  welcome          : '👋',
};

// Track which popups were already shown in this session
const _shown = new Set<string>();

export function NotificationPopup() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<NotifItem | null>(null);
  const [visible, setVisible] = useState(false);
  const [queue,   setQueue]   = useState<NotifItem[]>([]);

  // Fetch unread notifications
  const fetchNew = useCallback(async () => {
    try {
      const r = await notificationsApi.list();
      const unread: NotifItem[] = (r.data || [])
        .filter((n: NotifItem) => !n.is_read && !_shown.has(n.id))
        .slice(0, 5); // max 5 in queue
      if (unread.length > 0) setQueue(q => [...q, ...unread]);
    } catch { /* silent */ }
  }, []);

  // Initial fetch + poll every 30s
  useEffect(() => {
    fetchNew();
    const iv = setInterval(fetchNew, 30000);
    return () => clearInterval(iv);
  }, [fetchNew]);

  // Show next from queue
  useEffect(() => {
    if (visible || queue.length === 0) return;
    const [next, ...rest] = queue;
    _shown.add(next.id);
    setQueue(rest);
    setCurrent(next);
    setVisible(true);
  }, [queue, visible]);

  const dismiss = useCallback(async (markRead = true) => {
    setVisible(false);
    if (current && markRead) {
      await notificationsApi.read(current.id).catch(() => {});
    }
    setTimeout(() => setCurrent(null), 350); // wait for exit animation
  }, [current]);

  // Auto-dismiss after 7 seconds (only if no photo — photos need more time)
  useEffect(() => {
    if (!visible || !current) return;
    if (current.photo_url) return; // don't auto-dismiss if has image
    const t = setTimeout(() => dismiss(false), 7000);
    return () => clearTimeout(t);
  }, [visible, current, dismiss]);

  const handleTap = () => {
    if (!current) return;
    const payload = typeof current.payload === 'string'
      ? JSON.parse(current.payload) : (current.payload || {});
    dismiss(true);
    if (payload?.contractId) navigate(`/deal/${payload.contractId}`);
  };

  if (!current) return null;

  const icon = TYPE_ICON[current.type] || '🔔';
  const payload = typeof current.payload === 'string'
    ? JSON.parse(current.payload) : (current.payload || {});

  return (
    <div
      style={{
        position  : 'fixed',
        top       : '12px',
        left      : '12px',
        right     : '12px',
        zIndex    : 9999,
        transform : visible ? 'translateY(0)' : 'translateY(-110%)',
        opacity   : visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          background   : 'rgba(8,8,8,0.97)',
          border       : '1px solid rgba(204,68,255,0.5)',
          borderRadius : '16px',
          overflow     : 'hidden',
          boxShadow    : '0 8px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(204,68,255,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          position     : 'relative',
        }}
      >
        {/* Pixel grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)',
          backgroundSize: '5px 5px',
        }} />

        {/* Purple shimmer top border */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px', zIndex: 1,
          background: 'linear-gradient(90deg, transparent, #cc44ff, #ff44cc, transparent)',
          animation: 'shimmer 2.5s ease-in-out infinite',
        }} />

        {/* GIF / Photo */}
        {current.photo_url && (
          <div
            onClick={handleTap}
            style={{ cursor: payload?.contractId ? 'pointer' : 'default', position: 'relative', zIndex: 1 }}>
            <img
              src={current.photo_url}
              alt=""
              style={{
                width: '100%',
                maxHeight: '200px',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            {/* Gradient overlay at bottom of image */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px',
              background: 'linear-gradient(transparent, rgba(8,8,8,0.97))',
            }} />
          </div>
        )}

        {/* Content row */}
        <div
          onClick={handleTap}
          style={{
            padding: current.photo_url ? '10px 44px 14px 14px' : '14px 44px 14px 14px',
            cursor : payload?.contractId ? 'pointer' : 'default',
            position: 'relative', zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1.2 }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize  : '8px',
                fontFamily: '"Press Start 2P", monospace',
                color     : '#fff',
                lineHeight: '1.9',
                wordBreak : 'break-word',
              }}>
                {current.message}
              </div>
              {payload?.contractId && (
                <div style={{ marginTop: '6px', fontSize: '7px', color: '#cc44ff', fontFamily: '"Press Start 2P", monospace' }}>
                  TAP TO OPEN →
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => dismiss(true)}
          style={{
            position : 'absolute',
            top      : current.photo_url ? '8px' : '10px',
            right    : '10px',
            zIndex   : 10,
            width    : '28px',
            height   : '28px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)',
            border   : '1px solid rgba(255,255,255,0.2)',
            color    : 'rgba(255,255,255,0.8)',
            fontSize : '14px',
            cursor   : 'pointer',
            display  : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            backdropFilter: 'blur(8px)',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
