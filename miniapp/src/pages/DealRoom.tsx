import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { GlassCard, StatusPill, DataRow, Divider } from '../components/GlassCard';
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
  const { user }   = useTelegram();
  const [deal, setDeal]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const inviteUrl = (location.state as any)?.inviteUrl;

  useEffect(() => {
    if (!id) return;
    contractsApi.get(id).then(r => { setDeal(r.data); setLoading(false); }).catch(() => setLoading(false));
    // Polling каждые 10 сек для автообновления статуса
    const interval = setInterval(() => {
      contractsApi.get(id).then(r => setDeal(r.data)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <div className="page" style={{ textAlign: 'center', paddingTop: '40px' }}>
    <div style={{ fontSize: '24px', animation: 'pulse 1s infinite' }}>⏳</div>
  </div>;

  if (!deal) return <div className="page"><GlassCard>Сделка не найдена</GlassCard></div>;

  const log  = QUEST_LOG[deal.status] || ['Загрузка...'];
  const deadline = new Date(deal.deadline).toLocaleDateString('ru-RU');

  return (
    <div className="page fade-in">
      <PixelScene scene="deal_room" width={320} height={110} />

      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <h1 style={{ fontSize: '10px', color: '#fff' }}>{deal.title}</h1>
        <div style={{ marginTop: '6px' }}><StatusPill status={deal.status} /></div>
      </div>

      {/* Invite link (для клиента после создания) */}
      {inviteUrl && (
        <GlassCard style={{ background: 'rgba(0,255,136,0.07)', borderColor: 'rgba(0,255,136,0.25)' }}>
          <div style={{ fontSize: '8px', color: '#00FF88', marginBottom: '6px' }}>🔗 Ссылка для фрилансера</div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', wordBreak: 'break-all' }}>{inviteUrl}</div>
          <button className="btn btn-green btn-full" style={{ marginTop: '10px' }}
            onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success('Скопировано!'); }}>
            📋 СКОПИРОВАТЬ
          </button>
        </GlassCard>
      )}

      {/* Детали сделки */}
      <GlassCard>
        <DataRow label="Сумма"    value={`$${deal.amount_usd} ${deal.currency}`} color="#FFAA00" />
        <DataRow label="Дедлайн" value={deadline} />
        <DataRow label="Эскроу"  value={deal.escrow_status || '—'} color="#0088FF" />
        {deal.ton_contract_address && (
          <DataRow label="Контракт" value={`${deal.ton_contract_address.slice(0, 12)}...`} color="#CC44FF" />
        )}
      </GlassCard>

      {/* Квест-лог */}
      <GlassCard>
        <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>📜 КВЕСТ ЛОГ</div>
        {log.map((entry, i) => (
          <div key={i} style={{
            fontSize: '8px', padding: '6px 0',
            color: i === log.length - 1 ? '#00FF88' : 'rgba(255,255,255,0.45)',
            borderBottom: i < log.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            {entry}
          </div>
        ))}
      </GlassCard>

      {/* Действия */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {deal.status === 'signed' && (
          <button className="btn btn-gold btn-full" onClick={() => navigate(`/payment/${id}`)}>
            💳 ОПЛАТИТЬ
          </button>
        )}
        {deal.status === 'under_review' && (
          <button className="btn btn-green btn-full" onClick={() => navigate(`/review/${id}`)}>
            🔍 ПРОВЕРИТЬ РАБОТУ
          </button>
        )}
        {deal.status === 'in_progress' && (
          <button className="btn btn-blue btn-full" onClick={() => navigate(`/review/${id}`)}>
            📦 СДАТЬ РАБОТУ
          </button>
        )}
        {['in_progress','under_review','frozen'].includes(deal.status) && (
          <button className="btn btn-ghost btn-full" onClick={() => navigate(`/dispute/${id}`)}>
            ⚖️ ОТКРЫТЬ СПОР
          </button>
        )}
      </div>
    </div>
  );
}
