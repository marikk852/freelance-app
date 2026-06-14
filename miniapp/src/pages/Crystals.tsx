import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useTelegram } from '../hooks/useTelegram';
import { crystals as crystalsApi } from '../utils/api';
import toast from 'react-hot-toast';

// ============================================================
// Crystals — баланс, магазин (трата), покупка пакетов за TON
// ============================================================

type ShopItem = { key: string; label: string; cost: number; category: string };
type Package  = { id: number; crystals: number; bonus_crystals: number; price_usd: string };
type LedgerRow = { action_key: string | null; amount: number; kind: string; created_at: string };

const CAT_COLOR: Record<string, string> = {
  attention: '#0088ff', cosmetic: '#cc44ff', convenience: '#00ff88', general: '#ffaa00',
};

export function Crystals() {
  const navigate       = useNavigate();
  const { tg }         = useTelegram();
  const [tonConnectUI] = useTonConnectUI();
  const wallet         = useTonWallet();

  const [balance, setBalance]   = useState<number | null>(null);
  const [ledger, setLedger]     = useState<LedgerRow[]>([]);
  const [shop, setShop]         = useState<ShopItem[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [busyKey, setBusyKey]   = useState<string | null>(null);

  useEffect(() => {
    if (!tg?.BackButton) return;
    tg.BackButton.show();
    const back = () => navigate('/profile');
    tg.BackButton.onClick(back);
    return () => { tg.BackButton.offClick(back); tg.BackButton.hide(); };
  }, [tg, navigate]);

  const refresh = () => {
    crystalsApi.get().then(r => { setBalance(r.data.balance); setLedger(r.data.ledger || []); }).catch(() => {});
  };
  useEffect(() => {
    refresh();
    crystalsApi.shop().then(r => setShop(r.data)).catch(() => {});
    crystalsApi.packages().then(r => setPackages(r.data)).catch(() => {});
  }, []);

  const handleSpend = async (item: ShopItem) => {
    if (balance != null && balance < item.cost) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error('Not enough crystals');
      return;
    }
    setBusyKey(item.key);
    try {
      const r = await crystalsApi.spend(item.key);
      setBalance(r.data.balance);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success(`✓ ${item.label}`);
      refresh();
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Failed');
    } finally {
      setBusyKey(null);
    }
  };

  const handleBuyPackage = async (pkg: Package) => {
    if (!wallet) { tonConnectUI.openModal(); return; }
    setBusyKey(`pkg_${pkg.id}`);
    try {
      const res  = await crystalsApi.buyPackage(pkg.id);
      const pay  = res.data.payment;
      const nano = BigInt(Math.round(parseFloat(pay.amount) * 1e9)).toString();
      const tx   = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages  : [{ address: pay.to, amount: nano }],
      });
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Payment sent — verifying…');
      // confirm с авто-ретраем (сеть подтверждает до ~30с)
      let confirmed = false;
      for (let i = 0; i < 6 && !confirmed; i++) {
        try {
          await crystalsApi.confirmPackage({ package_id: pkg.id, tx_hash: tx.boc });
          confirmed = true;
        } catch (err: any) {
          if (err.response?.status !== 402) throw err;
          await new Promise(r => setTimeout(r, 5000));
        }
      }
      if (confirmed) {
        toast.success(`✓ +${(pkg.crystals + pkg.bonus_crystals).toLocaleString()} crystals!`);
        refresh();
      } else {
        toast('⏳ Still confirming — your crystals will arrive shortly.', { duration: 5000 });
      }
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      const msg = e?.message || '';
      toast.error(msg.includes('decline') || msg.includes('Reject') ? 'Payment cancelled' : 'Payment failed');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="page fade-in">
      <div className="sub-wrap">
        {/* Header + balance */}
        <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(255,170,0,0.3)', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="logo" style={{ color: '#ffaa00', textShadow: '0 0 10px rgba(255,170,0,0.7)', animation: 'none' }}>💎 CRYSTALS</div>
          <div className="px" style={{ fontSize: '16px', color: '#ffaa00' }}>
            {balance != null ? balance.toLocaleString() : '…'}
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            your balance
          </div>
        </div>

        {/* Packages — buy with TON */}
        {packages.length > 0 && (
          <>
            <div className="sec" style={{ margin: '14px 0 8px', color: 'rgba(255,255,255,0.4)' }}>-- BUY CRYSTALS --</div>
            <div className="sub-plans">
              {packages.map(pkg => {
                const total = pkg.crystals + pkg.bonus_crystals;
                return (
                  <div key={pkg.id} className="gl" style={{ marginBottom: '8px', borderColor: 'rgba(255,170,0,0.2)' }}>
                    <div className="pxgrid" />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                      <div>
                        <div className="px" style={{ fontSize: '10px', color: '#ffaa00' }}>{total.toLocaleString()} 💎</div>
                        {pkg.bonus_crystals > 0 && (
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: '#00ff88', marginTop: '4px' }}>
                            +{pkg.bonus_crystals.toLocaleString()} bonus
                          </div>
                        )}
                      </div>
                      <button className="btn btn-y" style={{ width: 'auto', padding: '10px 16px', fontSize: '8px', margin: 0 }}
                        disabled={busyKey === `pkg_${pkg.id}`}
                        onClick={() => handleBuyPackage(pkg)}>
                        {busyKey === `pkg_${pkg.id}` ? '⏳' : `$${pkg.price_usd}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Shop — spend */}
        {shop.length > 0 && (
          <>
            <div className="sec" style={{ margin: '14px 0 8px', color: 'rgba(255,255,255,0.4)' }}>-- SHOP --</div>
            {shop.map(item => {
              const col = CAT_COLOR[item.category] || '#ffaa00';
              const affordable = balance == null || balance >= item.cost;
              return (
                <div key={item.key} className="gl-sm" style={{ marginBottom: '7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                  <div className="pxgrid" />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.8)', position: 'relative', zIndex: 2, paddingRight: '8px' }}>
                    {item.label}
                  </span>
                  <button className="btn" style={{
                    width: 'auto', padding: '7px 12px', fontSize: '7px', margin: 0, flexShrink: 0,
                    background: affordable ? `${col}22` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${affordable ? col : 'rgba(255,255,255,0.1)'}`,
                    color: affordable ? col : 'rgba(255,255,255,0.3)',
                    cursor: affordable ? 'pointer' : 'not-allowed',
                  }}
                    disabled={busyKey === item.key || !affordable}
                    onClick={() => handleSpend(item)}>
                    {busyKey === item.key ? '⏳' : `${item.cost} 💎`}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* History */}
        {ledger.length > 0 && (
          <>
            <div className="sec" style={{ margin: '14px 0 8px', color: 'rgba(255,255,255,0.4)' }}>-- RECENT --</div>
            <div className="gl" style={{ padding: '10px 12px' }}>
              <div className="pxgrid" />
              {ledger.slice(0, 10).map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', position: 'relative', zIndex: 2, borderBottom: i < 9 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                    {row.action_key || row.kind}
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600, color: row.amount >= 0 ? '#00ff88' : '#ff4466' }}>
                    {row.amount >= 0 ? '+' : ''}{row.amount}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ height: '20px' }} />
      </div>
    </div>
  );
}
