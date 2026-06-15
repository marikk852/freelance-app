import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { DataRow } from '../components/GlassCard';
import { contracts as contractsApi, users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import toast from 'react-hot-toast';

// ============================================================
// Screen 04: PAYMENT — deploy contract + pay via TonConnect
// Флоу: STEP 1/2 deploy эскроу-контракта → STEP 2/2 депозит.
// Оплата ТОЛЬКО через TonConnect: ручной перевод без OP_DEPOSIT
// payload не активирует эскроу (контракт примет деньги молча).
// ============================================================

type PayStage = 'idle' | 'wallet' | 'freezing';

export function Payment() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tg }   = useTelegram();

  const [deal,     setDeal]     = useState<any>(null);
  const [profile,  setProfile]  = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [deployed,   setDeployed]   = useState<any>(null);
  const [estimate,   setEstimate]   = useState<{ ton_amount: string } | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [stage,      setStage]      = useState<PayStage>('idle');
  const [simulating, setSimulating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // Telegram BackButton — назад в сделку из любого состояния
  useEffect(() => {
    if (!tg?.BackButton) return;
    tg.BackButton.show();
    const goBack = () => navigate(`/deal/${id}`);
    tg.BackButton.onClick(goBack);
    return () => {
      tg.BackButton.offClick(goBack);
      tg.BackButton.hide();
    };
  }, [tg, navigate, id]);

  const loadData = () => {
    if (!id) return;
    setLoadError(false);
    Promise.all([contractsApi.get(id), usersApi.me()])
      .then(([dealRes, meRes]) => {
        setDeal(dealRes.data);
        setProfile(meRes.data);
      })
      .catch(() => setLoadError(true));
  };
  useEffect(loadData, [id]);

  // Contract already deployed (has ton_contract_address)
  useEffect(() => {
    if (deal?.ton_contract_address && deal?.crypto_amount) {
      const addr = deal.ton_contract_address;
      // Fake addresses from simulate mode are all-same-char: EQ+46×'S' or EQ+46×'A'
      const isSimulated = /^(EQ|kQ|0Q)[A-Z]{46}$/.test(addr) || /^(EQ|kQ|0Q)[a-z]{46}$/.test(addr);
      setDeployed({
        tonContractAddress: addr,
        cryptoAmount      : Number(deal.crypto_amount),
        simulated         : isSimulated,
      });
    }
  }, [deal]);

  // Оценка в TON до деплоя — юзер видит сумму до необратимого шага
  useEffect(() => {
    if (!id || !deal || deal.ton_contract_address) return;
    contractsApi.estimate(id)
      .then(r => setEstimate(r.data))
      .catch(() => {});
  }, [id, deal]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const fee          = deal ? (Number(deal.amount_usd) * 0.02).toFixed(2) : '0';
  const toFreelancer = deal ? (Number(deal.amount_usd) * 0.98).toFixed(2) : '0';

  const deadlineDate = deal?.deadline ? new Date(deal.deadline) : null;
  const isExpired    = deadlineDate !== null && deadlineDate.getTime() < Date.now();
  const deadlineStr  = deadlineDate
    ? deadlineDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  // Поллинг статуса после оплаты: монитор переводит сделку в in_progress,
  // когда контракт реально FROZEN (до ~60 секунд)
  const waitForFrozen = () => {
    setStage('freezing');
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const r = await contractsApi.get(id!);
        if (r.data.status === 'in_progress' || r.data.escrow_status === 'frozen') {
          if (pollRef.current) clearInterval(pollRef.current);
          tg?.HapticFeedback?.notificationOccurred('success');
          toast.success('✓ Funds frozen in escrow!');
          navigate(`/deal/${id}`);
        }
      } catch { /* следующий тик */ }
      if (Date.now() - startedAt > 90_000) {
        if (pollRef.current) clearInterval(pollRef.current);
        toast('⏳ Blockchain is still confirming — the deal will update automatically.', { duration: 5000 });
        navigate(`/deal/${id}`);
      }
    }, 5000);
  };

  const handleSimulate = async () => {
    tg?.HapticFeedback?.impactOccurred('heavy');
    setSimulating(true);
    try {
      await contractsApi.simulatePayment(id!);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Payment simulated! Deal is now in progress.');
      setTimeout(() => navigate(`/deal/${id}`), 1500);
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const handleDeploy = async () => {
    tg?.HapticFeedback?.impactOccurred('medium');
    setLoading(true);
    try {
      const res = await contractsApi.deploy(id!, {});
      setDeployed(res.data);
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Smart contract deployed!');
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      toast.error(e.response?.data?.error || 'Deployment error');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!deployed?.tonContractAddress || !deployed?.cryptoAmount) return;

    if (!wallet) {
      toast('Connect your wallet to send payment', { icon: '💎' });
      tonConnectUI.openModal();
      return;
    }

    tg?.HapticFeedback?.impactOccurred('heavy');
    setStage('wallet');
    try {
      let message;
      if (deal?.currency === 'USDT') {
        // USD₮ — jetton: backend строит payload и адрес jetton-wallet клиента.
        // Клиент шлёт jetton transfer на СВОЙ jetton-wallet (не на эскроу).
        const { data } = await contractsApi.usdtPayment(id!);
        message = {
          address: data.jettonWalletAddress,
          amount : data.amountTon,
          payload: data.payloadBoc,
        };
      } else {
        // TON — прямой депозит на эскроу с OP_DEPOSIT payload.
        // Gas buffer: 0.15 TON покрывает расходы арбитра (deploy + release + резерв).
        const GAS_BUFFER_NANO = BigInt(150_000_000); // 0.15 TON
        const nanotons = (BigInt(Math.round(deployed.cryptoAmount * 1e9)) + GAS_BUFFER_NANO).toString();
        // OP_DEPOSIT = 1, pre-encoded BOC: beginCell().storeUint(1,32).endCell().toBoc().toString('base64')
        const payload = 'te6cckEBAQEABgAACAAAAAHgg8T9';
        message = {
          address: deployed.tonContractAddress,
          amount : nanotons,
          payload,
        };
      }

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [message],
      });
      tg?.HapticFeedback?.notificationOccurred('success');
      waitForFrozen();
    } catch (e: any) {
      setStage('idle');
      tg?.HapticFeedback?.notificationOccurred('error');
      if (e?.message?.includes('User declined') || e?.message?.includes('Reject')) {
        toast.error('Payment cancelled');
      } else {
        toast.error('Payment failed. Try again.');
      }
    }
  };

  const dataLoaded = deal !== null && profile !== null;
  const hasWallet  = dataLoaded && !!profile?.ton_wallet_address;
  const busy       = stage !== 'idle';
  const isUsdt     = deal?.currency === 'USDT';
  // USD₮ — jetton: сумма уходит в USDT, газ платится отдельно в TON (~0.3).
  const USDT_GAS_TON = 0.3;
  const totalTon   = deployed
    ? (isUsdt ? deployed.cryptoAmount.toFixed(2) : (deployed.cryptoAmount + 0.15).toFixed(4))
    : null;

  const stepLabel = deployed ? 'STEP 2/2 · FUND ESCROW' : 'STEP 1/2 · CREATE ESCROW';

  return (
    <div className="page fade-in">
      <PixelScene scene="payment" width={252} height={56} />

      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(255,170,0,0.3)', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <div className="pxgrid" /><div className="sh" />
        <div className="logo" style={{ color: '#ffaa00', textShadow: '0 0 10px rgba(255,170,0,0.7)', animation: 'none' }}>💳 PAYMENT</div>
        <div style={{ textAlign: 'center', fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontFamily: '"Press Start 2P", monospace', lineHeight: 1.8 }}>
          {deal ? deal.title : '...'}
        </div>
        {dataLoaded && (
          <div className="px" style={{ textAlign: 'center', fontSize: '6px', color: '#ffaa00', letterSpacing: '1px' }}>
            {stepLabel}
          </div>
        )}
      </div>

      {/* Load error — честная ошибка вместо ложного "no wallet" */}
      {loadError && (
        <div className="gl card-stagger-2" style={{ borderColor: 'rgba(255,68,102,0.3)', textAlign: 'center', padding: '20px' }}>
          <div className="pxgrid" />
          <div className="px" style={{ fontSize: '8px', color: '#ff4466', marginBottom: '10px' }}>
            ⚠️ CONNECTION ERROR
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.5)', marginBottom: '12px', lineHeight: 1.6 }}>
            Could not load the deal. Check your connection.
          </div>
          <button className="btn btn-y btn-full" onClick={loadData} style={{ fontSize: '8px' }}>
            [ ↻ RETRY ]
          </button>
        </div>
      )}

      {/* Skeleton при загрузке */}
      {!dataLoaded && !loadError && (
        <div className="gl card-stagger-2" style={{ padding: '20px' }}>
          <div className="pxgrid" />
          {[100, 80, 90].map((w, i) => (
            <div key={i} style={{
              height: '12px', width: `${w}%`, marginBottom: '10px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.2s infinite',
            }} />
          ))}
        </div>
      )}

      {/* Amount breakdown */}
      {dataLoaded && (
        <div className="gl card-stagger-2" style={{ borderColor: 'rgba(255,170,0,0.25)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="sec" style={{ margin: '0 0 10px', padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
            -- AMOUNT BREAKDOWN --
          </div>
          <DataRow label="Deal amount"         value={`$${deal.amount_usd}`}  color="#ffaa00" />
          <DataRow label="Platform fee (2%)"   value={`-$${fee}`}             color="#ff4466" />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />
          <DataRow label="Freelancer receives"  value={`$${toFreelancer}`}    color="#00ff88" />
          {(deployed || estimate) && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />
              <DataRow
                label={deployed ? `Deal in ${deal.currency}` : `Estimate in ${deal.currency}`}
                value={`${deployed ? deployed.cryptoAmount.toFixed(4) : `≈ ${estimate?.ton_amount}`} ${deal.currency}`}
                color="#0088ff"
              />
              <DataRow
                label="Network fees"
                value={isUsdt ? `+~${USDT_GAS_TON} TON (gas)` : `+0.15 ${deal.currency}`}
                color="rgba(255,255,255,0.3)"
              />
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />
              <DataRow
                label="TOTAL TO SEND"
                value={isUsdt
                  ? `${deployed ? totalTon : Number(deal.amount_usd).toFixed(2)} USDT + ~${USDT_GAS_TON} TON`
                  : `${deployed ? totalTon : `≈ ${(Number(estimate?.ton_amount) + 0.15).toFixed(4)}`} ${deal.currency}`}
                color="#ffaa00"
              />
            </>
          )}
          {deadlineStr && (
            <div className="px" style={{
              fontSize: '6px', textAlign: 'center', marginTop: '10px', letterSpacing: '0.5px',
              color: isExpired ? '#ff4466' : 'rgba(255,170,0,0.7)',
            }}>
              {isExpired ? `⛔ DEADLINE PASSED · ${deadlineStr}` : `⏰ PAY BEFORE ${deadlineStr}`}
            </div>
          )}
        </div>
      )}

      {/* Wallet warning — только когда профиль реально загружен */}
      {dataLoaded && !hasWallet && (
        <div className="gl card-stagger-3" style={{ borderColor: 'rgba(255,68,102,0.3)', background: 'rgba(255,68,102,0.05)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="px" style={{ fontSize: '8px', color: '#FF4466', textAlign: 'center' }}>
            ⚠️ NO WALLET LINKED
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.45)', marginTop: '8px', textAlign: 'center', lineHeight: 1.6 }}>
            Link your TON wallet first — it's where funds return if the deal is refunded.
          </div>
          <button className="btn btn-full" style={{ marginTop: '10px', fontSize: '8px' }}
            onClick={() => navigate('/profile')}>
            [ 👤 GO TO PROFILE ]
          </button>
        </div>
      )}

      {dataLoaded && deployed && (
        /* STEP 2/2 — contract deployed, fund it */
        <div className="gl card-stagger-3" style={{ borderColor: 'rgba(0,255,136,0.3)', background: 'rgba(0,255,136,0.04)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="px" style={{ fontSize: '8px', color: '#00ff88', marginBottom: '10px', textAlign: 'center' }}>
            ✅ CONTRACT READY
          </div>
          <div className="px" style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
            CONTRACT ADDRESS
          </div>
          <div style={{
            fontSize: '8px', fontFamily: '"Press Start 2P", monospace', color: '#0088ff', wordBreak: 'break-all', marginBottom: '12px',
            padding: '8px', background: 'rgba(0,136,255,0.08)', borderRadius: '8px',
            border: '1px solid rgba(0,136,255,0.2)', lineHeight: 1.8,
          }}>
            {deployed.tonContractAddress}
          </div>

          {deployed.simulated ? (
            /* Simulate mode — no real blockchain */
            <button className="btn btn-y btn-full"
              onClick={handleSimulate}
              disabled={simulating}
              style={{ marginBottom: '8px', fontSize: '8px' }}>
              {simulating ? '[ ⏳ SIMULATING... ]' : '[ 🧪 SIMULATE PAYMENT ]'}
            </button>
          ) : isExpired ? (
            <div style={{
              fontSize: '12px', fontFamily: 'Inter, sans-serif', color: '#ff4466', textAlign: 'center',
              padding: '10px', background: 'rgba(255,68,102,0.07)', borderRadius: '8px',
              border: '1px solid rgba(255,68,102,0.25)', lineHeight: 1.6, marginBottom: '8px',
            }}>
              The deadline has passed — the contract no longer accepts deposits.
              Reopen the deal with a new deadline or contact support.
            </div>
          ) : (
            <>
              <button className="btn btn-g btn-full"
                onClick={handlePay}
                disabled={busy}
                style={{ marginBottom: '8px', fontSize: '8px', opacity: busy ? 0.75 : 1 }}>
                {stage === 'wallet'
                  ? '[ 👛 CONFIRM IN WALLET ↗ ]'
                  : stage === 'freezing'
                    ? '[ ⏳ FREEZING FUNDS... ]'
                    : wallet
                      ? `[ 💎 PAY ${totalTon} ${deal?.currency || 'TON'} ]`
                      : isUsdt
                        ? `[ 💎 CONNECT WALLET & PAY USDT ]`
                        : `[ 💎 CONNECT WALLET & PAY ]`}
              </button>
              {stage === 'freezing' && (
                <div style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', color: 'rgba(0,255,136,0.7)', textAlign: 'center', marginBottom: '8px', lineHeight: 1.6 }}>
                  Payment sent — waiting for the blockchain to freeze funds in escrow (~1 min)…
                </div>
              )}
              {/* Ручной перевод НЕ работает: без OP_DEPOSIT payload эскроу не активируется */}
              <div className="px" style={{
                fontSize: '6px', color: 'rgba(255,170,0,0.6)', textAlign: 'center',
                lineHeight: 2, marginBottom: '8px', letterSpacing: '0.5px',
              }}>
                ⚠ PAY ONLY VIA THE BUTTON — MANUAL TRANSFERS WON'T ACTIVATE THE ESCROW
              </div>
            </>
          )}

          <button className="btn btn-gr btn-full" style={{ fontSize: '8px' }}
            onClick={() => navigate(`/deal/${id}`)}>
            [ ◀ BACK TO DEAL ]
          </button>
        </div>
      )}

      {dataLoaded && !deployed && hasWallet && (
        /* STEP 1/2 — deploy escrow contract */
        <div className="gl card-stagger-3">
          <div className="pxgrid" /><div className="sh" />
          <div className="px" style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>YOUR WALLET</div>
          <div style={{
            fontSize: '8px', fontFamily: '"Press Start 2P", monospace', color: '#00ff88', wordBreak: 'break-all',
            padding: '8px 10px', background: 'rgba(0,255,136,0.06)',
            border: '1px solid rgba(0,255,136,0.15)', borderRadius: '8px', lineHeight: 1.8,
          }}>
            ✅ {profile?.ton_wallet_address?.slice(0, 10)}...{profile?.ton_wallet_address?.slice(-6)}
          </div>

          <button className="btn btn-y btn-full"
            onClick={handleDeploy}
            disabled={loading || isExpired}
            style={{ marginTop: '14px', opacity: isExpired ? 0.5 : 1 }}>
            {loading ? '[ ⏳ DEPLOYING... ]' : isExpired ? '[ ⛔ DEADLINE PASSED ]' : '[ 🚀 DEPLOY CONTRACT ]'}
          </button>
          <div className="px" style={{ fontSize: '6px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: '8px', lineHeight: 2 }}>
            CREATES YOUR PERSONAL ESCROW CONTRACT ON TON.
            NEXT STEP — FUND IT FROM YOUR WALLET
          </div>
        </div>
      )}
    </div>
  );
}
