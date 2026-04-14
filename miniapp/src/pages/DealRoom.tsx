import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { StatusPill, DataRow } from '../components/GlassCard';
import { contracts as contractsApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Экран 03: DEAL ROOM — комната сделки, квест-лог
// ============================================================

const QUEST_LOG: Record<string, string[]> = {
  draft              : ['📜 Контракт создан'],
  pending_signature  : ['📜 Контракт создан', '✍️ Ожидаем подпись фрилансера'],
  signed             : ['📜 Создан', '✍️ Подписан', '⏳ Ожидаем оплату'],
  awaiting_payment   : ['📜 Создан', '✍️ Подписан', '💳 Ожидаем оплату'],
  in_progress        : ['📜 Создан', '✍️ Подписан', '🔒 Деньги заморожены', '🔄 Работа идёт'],
  under_review       : ['📜 Создан', '✍️ Подписан', '🔒 Заморожено', '📦 Работа сдана', '🔍 На проверке'],
  completed          : ['📜 Создан', '✍️ Подписан', '🔒 Заморожено', '📦 Сдано', '✅ Завершено!'],
  disputed           : ['📜 Создан', '✍️ Подписан', '🔒 Заморожено', '⚖️ Спор открыт'],
};

export function DealRoom() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user, tg } = useTelegram();
  const [deal, setDeal]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const inviteUrl = (location.state as any)?.inviteUrl;

  useEffect(() => {
    if (!id) return;
    contractsApi.get(id).then(r => { setDeal(r.data); setLoading(false); }).catch(() => setLoading(false));
    const interval = setInterval(() => {
      contractsApi.get(id).then(r => setDeal(r.data)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '60px' }}>
      <div style={{ fontSize: '28px', animation: 'float 2s ease-in-out infinite' }}>🏰</div>
      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginTop: '12px' }}>ЗАГРУЖАЕМ КВЕСТ...</div>
    </div>
  );

  if (!deal) return (
    <div className="page">
      <div className="gl" style={{ textAlign: 'center', padding: '32px' }}>
        <div className="pxgrid" />
        <div style={{ fontSize: '24px' }}>❓</div>
        <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>Сделка не найдена</div>
      </div>
    </div>
  );

  const log      = QUEST_LOG[deal.status] || ['Загрузка...'];
  const deadline = new Date(deal.deadline).toLocaleDateString('ru-RU');

  const go = (path: string) => {
    tg?.HapticFeedback?.impactOccurred('medium');
    navigate(path);
  };

  return (
    <div className="page fade-in">
      <PixelScene scene="deal_room" width={252} height={56} />

      {/* Заголовок */}
      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div style={{ textAlign: 'center' }}>
          <div className="logo" style={{ fontSize: '8px' }}>{deal.title?.toUpperCase()}</div>
          <div style={{ marginTop: '6px' }}><StatusPill status={deal.status} /></div>
        </div>
      </div>

      {/* Invite link */}
      {inviteUrl && (
        <div className="gl card-stagger-2" style={{ borderColor: 'rgba(0,255,136,0.3)', background: 'rgba(0,255,136,0.05)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '8px', color: '#00ff88', marginBottom: '6px' }}>🔗 ССЫЛКА ДЛЯ ФРИЛАНСЕРА</div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.45)', wordBreak: 'break-all', marginBottom: '10px' }}>
            {inviteUrl}
          </div>
          <button className="btn btn-g btn-full"
            onClick={() => { navigator.clipboard.writeText(inviteUrl); tg?.HapticFeedback?.notificationOccurred('success'); toast.success('Скопировано!'); }}>
            [ 📋 СКОПИРОВАТЬ ]
          </button>
        </div>
      )}

      {/* Детали */}
      <div className="gl card-stagger-2" style={{ borderColor: 'rgba(255,170,0,0.2)' }}>
        <div className="pxgrid" /><div className="sh" />
        <div className="sec" style={{ margin: '0 0 10px', padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
          -- ДЕТАЛИ КВЕСТА --
        </div>
        <DataRow label="Сумма"    value={`$${deal.amount_usd} ${deal.currency}`} color="#ffaa00" />
        <DataRow label="Дедлайн" value={deadline} />
        <DataRow label="Эскроу"  value={deal.escrow_status || '—'} color="#0088ff" />
        {deal.ton_contract_address && (
          <DataRow label="Контракт" value={`${deal.ton_contract_address.slice(0, 12)}...`} color="#cc44ff" />
        )}
      </div>

      {/* Квест-лог */}
      <div className="gl card-stagger-3">
        <div className="pxgrid" /><div className="sh" />
        <div className="sec" style={{ margin: '0 0 10px', padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
          -- КВЕСТ ЛОГ --
        </div>
        {log.map((entry, i) => (
          <div key={i} style={{
            fontSize: '8px', padding: '7px 0',
            color: i === log.length - 1 ? '#00ff88' : 'rgba(255,255,255,0.4)',
            borderBottom: i < log.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
              background: i === log.length - 1 ? '#00ff88' : 'rgba(255,255,255,0.2)',
              boxShadow: i === log.length - 1 ? '0 0 6px #00ff88' : 'none',
            }} />
            {entry}
          </div>
        ))}
      </div>

      {/* HP bar (progress visualization) */}
      <div className="gl card-stagger-4" style={{ padding: '10px 14px' }}>
        <div className="pxgrid" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)' }}>ПРОГРЕСС КВЕСТА</span>
          <span style={{ fontSize: '7px', color: '#ffaa00' }}>{Math.round((log.length / 5) * 100)}%</span>
        </div>
        <div className="hp-t">
          <div className="hp-b" style={{
            '--hp': `${Math.round((log.length / 5) * 100)}%`,
            background: 'linear-gradient(90deg,#ffaa00,#ff6600)',
          } as any} />
        </div>
      </div>

      {/* Действия */}
      <div className="card-stagger-5" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {deal.status === 'signed' && (
          <button className="btn btn-y btn-full" onClick={() => go(`/payment/${id}`)}>
            [ 💳 ОПЛАТИТЬ ]
          </button>
        )}
        {deal.status === 'under_review' && (
          <button className="btn btn-g btn-full" onClick={() => go(`/review/${id}`)}>
            [ 🔍 ПРОВЕРИТЬ РАБОТУ ]
          </button>
        )}
        {deal.status === 'in_progress' && (
          <button className="btn btn-b btn-full" onClick={() => go(`/review/${id}`)}>
            [ 📦 СДАТЬ РАБОТУ ]
          </button>
        )}
        {['in_progress','under_review','frozen'].includes(deal.status) && (
          <button className="btn btn-gr btn-full" onClick={() => go(`/dispute/${id}`)}>
            [ ⚖️ ОТКРЫТЬ СПОР ]
          </button>
        )}
      </div>
    </div>
  );
}
