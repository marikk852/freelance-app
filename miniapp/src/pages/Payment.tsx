import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { DataRow } from '../components/GlassCard';
import { contracts as contractsApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Экран 04: PAYMENT — выбор валюты TON/USDT, адрес контракта
// ============================================================

export function Payment() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tg }   = useTelegram();
  const [deal,    setDeal]    = useState<any>(null);
  const [currency, setCurrency] = useState<'TON'|'USDT'>('USDT');
  const [wallets, setWallets] = useState({ client: '', freelancer: '' });
  const [loading, setLoading] = useState(false);
  const [deployed, setDeployed] = useState<any>(null);

  useEffect(() => {
    if (id) contractsApi.get(id).then(r => setDeal(r.data));
  }, [id]);

  const handleDeploy = async () => {
    if (!wallets.client || !wallets.freelancer) {
      tg?.HapticFeedback?.notificationOccurred('error');
      return toast.error('Введи оба TON адреса');
    }
    tg?.HapticFeedback?.impactOccurred('medium');
    setLoading(true);
    try {
      const res = await contractsApi.deploy(id!, {
        clientWallet     : wallets.client,
        freelancerWallet : wallets.freelancer,
      });
      setDeployed(res.data);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Смарт-контракт задеплоен!');
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Ошибка деплоя');
    } finally {
      setLoading(false);
    }
  };

  const fee          = deal ? (Number(deal.amount_usd) * 0.02).toFixed(2) : '0';
  const toFreelancer = deal ? (Number(deal.amount_usd) * 0.98).toFixed(2) : '0';

  return (
    <div className="page fade-in">
      <PixelScene scene="payment" width={252} height={56} />

      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div className="logo">💳 ОПЛАТА</div>
        {deal && (
          <div style={{ textAlign: 'center', fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {deal.title}
          </div>
        )}
      </div>

      {/* Разбивка суммы */}
      {deal && (
        <div className="gl card-stagger-2" style={{ borderColor: 'rgba(255,170,0,0.25)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="sec" style={{ margin: '0 0 10px', padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
            -- РАЗБИВКА СУММЫ --
          </div>
          <DataRow label="Сумма сделки"      value={`$${deal.amount_usd}`} color="#ffaa00" />
          <DataRow label="Комиссия (2%)"     value={`-$${fee}`}           color="#ff4466" />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />
          <DataRow label="Фрилансер получит" value={`$${toFreelancer}`}   color="#00ff88" />
        </div>
      )}

      {deployed ? (
        /* Контракт задеплоен — показываем адрес */
        <div className="gl card-stagger-3" style={{ borderColor: 'rgba(0,255,136,0.3)', background: 'rgba(0,255,136,0.04)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '9px', color: '#00ff88', marginBottom: '10px', textAlign: 'center' }}>
            ✅ КОНТРАКТ ГОТОВ
          </div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
            АДРЕС КОНТРАКТА
          </div>
          <div style={{ fontSize: '7px', color: '#0088ff', wordBreak: 'break-all', marginBottom: '10px',
            padding: '8px', background: 'rgba(0,136,255,0.08)', borderRadius: '8px',
            border: '1px solid rgba(0,136,255,0.2)' }}>
            {deployed.tonContractAddress}
          </div>
          <div style={{ fontSize: '8px', color: '#ffaa00', marginBottom: '12px', textAlign: 'center' }}>
            Отправь <b>{deployed.cryptoAmount.toFixed(4)} {currency}</b> на этот адрес
          </div>
          <button className="btn btn-g btn-full"
            onClick={() => {
              navigator.clipboard.writeText(deployed.tonContractAddress);
              tg?.HapticFeedback?.notificationOccurred('success');
              toast.success('Адрес скопирован!');
            }}>
            [ 📋 СКОПИРОВАТЬ АДРЕС ]
          </button>
          <button className="btn btn-gr btn-full" style={{ marginTop: '8px' }}
            onClick={() => navigate(`/deal/${id}`)}>
            [ ◀ К СДЕЛКЕ ]
          </button>
        </div>
      ) : (
        <>
          {/* Выбор валюты и кошельки */}
          <div className="gl card-stagger-3">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>ВАЛЮТА</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {(['TON','USDT'] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`btn btn-full ${currency === c ? 'btn-b' : 'btn-gr'}`}>
                  {c === 'TON' ? '💎 TON' : '💵 USDT'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
              TON КОШЕЛЁК КЛИЕНТА
            </div>
            <input className="input" placeholder="UQ..." value={wallets.client}
              onChange={e => setWallets(w => ({ ...w, client: e.target.value }))}
              style={{ marginBottom: '10px' }} />
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
              TON КОШЕЛЁК ФРИЛАНСЕРА
            </div>
            <input className="input" placeholder="UQ..." value={wallets.freelancer}
              onChange={e => setWallets(w => ({ ...w, freelancer: e.target.value }))} />
          </div>

          <button className="btn btn-y btn-full card-stagger-4"
            onClick={handleDeploy} disabled={loading}>
            {loading ? '[ ⏳ ДЕПЛОИМ... ]' : '[ 🚀 ЗАДЕПЛОИТЬ КОНТРАКТ ]'}
          </button>
        </>
      )}
    </div>
  );
}
