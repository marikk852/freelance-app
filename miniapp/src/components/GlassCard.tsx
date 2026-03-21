import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

/** Стеклянная карточка — базовый строительный блок UI */
export function GlassCard({ children, className = '', style, onClick }: GlassCardProps) {
  return (
    <div
      className={`glass ${className}`}
      style={{ padding: '16px', marginBottom: '12px', ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/** Строка статуса с цветной точкой */
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    waiting         : { label: 'Ожидание',   cls: 'pill-orange' },
    active          : { label: 'Активна',    cls: 'pill-blue'   },
    in_progress     : { label: 'В работе',   cls: 'pill-blue'   },
    under_review    : { label: 'На проверке',cls: 'pill-purple'  },
    awaiting_payment: { label: 'Оплата',     cls: 'pill-orange' },
    completed       : { label: 'Завершена',  cls: 'pill-green'  },
    disputed        : { label: 'Спор',       cls: 'pill-red'    },
    frozen          : { label: 'Заморожено', cls: 'pill-blue'   },
    released        : { label: 'Выплачено',  cls: 'pill-green'  },
    refunded        : { label: 'Возврат',    cls: 'pill-orange' },
  };
  const s = map[status] || { label: status, cls: 'pill-orange' };
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
}

/** Разделитель */
export function Divider() {
  return <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '12px 0' }} />;
}

/** Строка данных label: value */
export function DataRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px' }}>{label}</span>
      <span style={{ color: color || '#fff', fontSize: '9px' }}>{value}</span>
    </div>
  );
}
