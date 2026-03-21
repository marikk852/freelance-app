import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { GlassCard, DataRow, Divider } from '../components/GlassCard';
import { contracts as contractsApi } from '../utils/api';
import toast from 'react-hot-toast';

// ============================================================
// Экран 04: PAYMENT — выбор валюты TON/USDT, адрес контракта
// ============================================================

export function Payment() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deal, setDeal]       = useState<any>(null);
  const [currency, setCurrency] = useState<'TON'|'USDT'>('USDT');
  const [wallets, setWallets] = useState({ client: '', freelancer: '' });
  const [loading, setLoading] = useState(false);
  const [deployed, setDeployed] = useState<any>(null);

  useEffect(() => {
    if (id) contractsApi.get(id).then(r => setDeal(r.data));
  }, [id]);

  const handleDeploy = async () => {
    if (!wallets.client || !wallets.freelancer) {
      return toast.error('Введи оба TON адреса');
    }
    setLoading(true);
    try {
      const res = await contractsApi.deploy(id!, {
        clientWallet     : wallets.client,
        freelancerWallet : wallets.freelancer,
      });
      setDeployed(res.data);
      toast.success('Смарт-контракт задеплоен!');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Ошибка деплоя');
    } finally {
      setLoading(false);
    }
  };

  const fee = deal ? (Number(deal.amount_usd) * 0.02).toFixed(2) : '0';
  const toFreelancer = deal ? (Number(deal.amount_usd) * 0.98).toFixed(2) : '0';

  return (
    <div className="page fade-in">
      <PixelScene scene="payment" width={320} height={110} />

      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <h1 style={{ fontSize: '11px', color: '#FFAA00' }}>💳 ОПЛАТА</h1>
        {deal && <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{deal.title}</p>}
      </div>

      {/* Разбивка суммы */}
      {deal && (
        <GlassCard style={{ background: 'rgba(255,170,0,0.05)', borderColor: 'rgba(255,170,0,0.2)' }}>
          <DataRow label="Сумма сделки"      value={`$${deal.amount_usd}`} color="#FFAA00" />
          <DataRow label="Комиссия (2%)"     value={`-$${fee}`}           color="#FF4466" />
          <Divider />
          <DataRow label="Фрилансер получит" value={`$${toFreelancer}`}   color="#00FF88" />
        </GlassCard>
      )}

      {/* Если уже задеплоен */}
      {deployed ? (
        <GlassCard style={{ background: 'rgba(0,255,136,0.06)', borderColor: 'rgba(0,255,136,0.2)' }}>
          <div style={{ fontSize: '9px', color: '#00FF88', marginBottom: '10px' }}>✅ Контракт готов</div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Адрес контракта:</div>
          <div style={{ fontSize: '7px', color: '#0088FF', wordBreak: 'break-all', marginBottom: '10px' }}>
            {deployed.tonContractAddress}
          </div>
          <div style={{ fontSize: '8px', color: '#FFAA00', marginBottom: '10px' }}>
            Отправь <b>{deployed.cryptoAmount.toFixed(4)} {currency}</b> на этот адрес
          </div>
          <button className="btn btn-green btn-full"
            onClick={() => { navigator.clipboard.writeText(deployed.tonContractAddress); toast.success('Адрес скопирован!'); }}>
            📋 СКОПИРОВАТЬ АДРЕС
          </button>
          <button className="btn btn-ghost btn-full" style={{ marginTop: '8px' }}
            onClick={() => navigate(`/deal/${id}`)}>
            ◀ К СДЕЛКЕ
          </button>
        </GlassCard>
      ) : (
        <>
          {/* Выбор валюты */}
          <GlassCard>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>Валюта</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {(['TON','USDT'] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`btn btn-full ${currency === c ? 'btn-blue' : 'btn-ghost'}`}>
                  {c === 'TON' ? '💎 TON' : '💵 USDT'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>TON кошелёк клиента</div>
            <input className="input" placeholder="UQ..." value={wallets.client}
              onChange={e => setWallets(w => ({ ...w, client: e.target.value }))}
              style={{ marginBottom: '10px' }} />
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>TON кошелёк фрилансера</div>
            <input className="input" placeholder="UQ..." value={wallets.freelancer}
              onChange={e => setWallets(w => ({ ...w, freelancer: e.target.value }))} />
          </GlassCard>

          <button className="btn btn-gold btn-full" onClick={handleDeploy} disabled={loading}>
            {loading ? '⏳ ДЕПЛОИМ...' : '🚀 ЗАДЕПЛОИТЬ КОНТРАКТ'}
          </button>
        </>
      )}
    </div>
  );
}
