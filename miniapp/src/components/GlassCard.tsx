import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  sm?: boolean;
}

export function GlassCard({ children, className = '', style, onClick, sm }: GlassCardProps) {
  const base = sm ? 'gl-sm' : 'gl';
  return (
    <div className={`${base} ${className}`} style={style} onClick={onClick}>
      <div className="pxgrid" />
      <div className="sh" />
      {children}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    waiting         : { label: 'WAITING',   color: '#ff8800', bg: 'rgba(255,136,0,0.1)',   border: 'rgba(255,136,0,0.4)'   },
    active          : { label: 'ACTIVE',    color: '#0088ff', bg: 'rgba(0,136,255,0.1)',  border: 'rgba(0,136,255,0.4)'  },
    in_progress     : { label: 'WORKING',   color: '#0088ff', bg: 'rgba(0,136,255,0.1)',  border: 'rgba(0,136,255,0.4)'  },
    under_review    : { label: 'REVIEW',    color: '#cc44ff', bg: 'rgba(204,68,255,0.1)', border: 'rgba(204,68,255,0.4)' },
    awaiting_payment: { label: 'PAYMENT',   color: '#ff8800', bg: 'rgba(255,136,0,0.1)',  border: 'rgba(255,136,0,0.4)'  },
    completed       : { label: 'DONE',      color: '#00ff88', bg: 'rgba(0,255,136,0.1)',  border: 'rgba(0,255,136,0.4)'  },
    disputed        : { label: 'DISPUTE',   color: '#ff4466', bg: 'rgba(255,68,102,0.1)', border: 'rgba(255,68,102,0.4)' },
    frozen          : { label: 'FROZEN',    color: '#0088ff', bg: 'rgba(0,136,255,0.1)',  border: 'rgba(0,136,255,0.4)'  },
    released        : { label: 'PAID',      color: '#00ff88', bg: 'rgba(0,255,136,0.1)',  border: 'rgba(0,255,136,0.4)'  },
    refunded        : { label: 'REFUNDED',  color: '#ff8800', bg: 'rgba(255,136,0,0.1)',  border: 'rgba(255,136,0,0.4)'  },
  };
  const s = map[status] || { label: status.toUpperCase(), color: '#ff8800', bg: 'rgba(255,136,0,0.1)', border: 'rgba(255,136,0,0.4)' };
  return (
    <span className="badge gl-pill" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

export function Divider() {
  return <div className="div" />;
}

export function DataRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="fee">
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      <span style={{ color: color || '#fff' }}>{value}</span>
    </div>
  );
}
