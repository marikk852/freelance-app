import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PixelScene } from '../components/PixelScene';
import { DataRow } from '../components/GlassCard';
import { contracts as contractsApi, users as usersApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import toast from 'react-hot-toast';

// ============================================================
// Screen 04: PAYMENT — deploy contract + pay via TonConnect
// ============================================================

export function Payment() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tg }   = useTelegram();

  const [deal,     setDeal]     = useState<any>(null);
  const [profile,  setProfile]  = useState<any>(null);
  const [deployed,   setDeployed]   = useState<any>(null);
  const [loading,    setLoading]    = useState(false);
  const [paying,     setPaying]     = useState(false);
  const [simulating, setSimulating] = useState(false);

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  useEffect(() => {
    if (!id) return;
    contractsApi.get(id).then(r => setDeal(r.data));
    usersApi.me().then(r => setProfile(r.data));
  }, [id]);

  // Check if contract already deployed (has ton_contract_address)
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

  const fee          = deal ? (Number(deal.amount_usd) * 0.02).toFixed(2) : '0';
  const toFreelancer = deal ? (Number(deal.amount_usd) * 0.98).toFixed(2) : '0';

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
    setPaying(true);
    try {
      const nanotons = BigInt(Math.round(deployed.cryptoAmount * 1e9)).toString();

      // OP_DEPOSIT = 1, pre-encoded BOC: beginCell().storeUint(1,32).endCell().toBoc().toString('base64')
      const payload = 'te6cckEBAQEABgAACAAAAAHgg8T9';

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{
          address: deployed.tonContractAddress,
          amount : nanotons,
          payload,
        }],
      });
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success('Payment sent! Waiting for confirmation...');
      setTimeout(() => navigate(`/deal/${id}`), 2000);
    } catch (e: any) {
      tg?.HapticFeedback?.notificationOccurred('error');
      if (e?.message?.includes('User declined') || e?.message?.includes('Reject')) {
        toast.error('Payment cancelled');
      } else {
        toast.error('Payment failed. Try again.');
      }
    } finally {
      setPaying(false);
    }
  };

  const hasWallet = !!profile?.ton_wallet_address;

  return (
    <div className="page fade-in">
      <PixelScene scene="payment" width={252} height={56} />

      <div className="gl hud card-stagger-1">
        <div className="pxgrid" /><div className="sh" />
        <div className="logo">💳 PAYMENT</div>
        {deal && (
          <div style={{ textAlign: 'center', fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {deal.title}
          </div>
        )}
      </div>

      {/* Amount breakdown */}
      {deal && (
        <div className="gl card-stagger-2" style={{ borderColor: 'rgba(255,170,0,0.25)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="sec" style={{ margin: '0 0 10px', padding: 0, border: 'none', color: 'rgba(255,255,255,0.3)' }}>
            -- AMOUNT BREAKDOWN --
          </div>
          <DataRow label="Deal amount"         value={`$${deal.amount_usd}`}  color="#ffaa00" />
          <DataRow label="Platform fee (2%)"   value={`-$${fee}`}             color="#ff4466" />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />
          <DataRow label="Freelancer receives"  value={`$${toFreelancer}`}    color="#00ff88" />
          {deployed && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 0' }} />
              <DataRow label={`Amount in ${deal.currency}`} value={`${deployed.cryptoAmount.toFixed(4)} ${deal.currency}`} color="#0088ff" />
            </>
          )}
        </div>
      )}

      {/* Wallet warning */}
      {!hasWallet && (
        <div className="gl card-stagger-3" style={{ borderColor: 'rgba(255,68,102,0.3)', background: 'rgba(255,68,102,0.05)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '8px', color: '#FF4466', textAlign: 'center' }}>
            ⚠️ NO WALLET LINKED
          </div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', textAlign: 'center', lineHeight: '1.8' }}>
            Add your TON wallet in Profile first
          </div>
          <button className="btn btn-full" style={{ marginTop: '10px', fontSize: '7px' }}
            onClick={() => navigate('/profile')}>
            [ 👤 GO TO PROFILE ]
          </button>
        </div>
      )}

      {deployed ? (
        /* Contract deployed — show address + pay button */
        <div className="gl card-stagger-3" style={{ borderColor: 'rgba(0,255,136,0.3)', background: 'rgba(0,255,136,0.04)' }}>
          <div className="pxgrid" /><div className="sh" />
          <div style={{ fontSize: '9px', color: '#00ff88', marginBottom: '10px', textAlign: 'center' }}>
            ✅ CONTRACT READY
          </div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
            CONTRACT ADDRESS
          </div>
          <div style={{
            fontSize: '7px', color: '#0088ff', wordBreak: 'break-all', marginBottom: '12px',
            padding: '8px', background: 'rgba(0,136,255,0.08)', borderRadius: '8px',
            border: '1px solid rgba(0,136,255,0.2)',
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
          ) : (
            <>
              {/* Pay via TonConnect */}
              {!wallet && (
                <div style={{ fontSize: '7px', color: 'rgba(255,170,0,0.7)', textAlign: 'center', marginBottom: '8px', lineHeight: '1.8', padding: '6px 10px', background: 'rgba(255,170,0,0.06)', borderRadius: '8px', border: '1px solid rgba(255,170,0,0.15)' }}>
                  ⚠️ Tap below to open TonKeeper/Tonhub and sign the transaction
                </div>
              )}
              <button className="btn btn-g btn-full"
                onClick={handlePay}
                disabled={paying}
                style={{ marginBottom: '8px', fontSize: '8px' }}>
                {paying
                  ? '[ ⏳ SENDING... ]'
                  : wallet
                    ? `[ 💎 PAY ${deployed.cryptoAmount.toFixed(4)} ${deal?.currency || 'TON'} ]`
                    : `[ 💎 OPEN WALLET & PAY ${deployed.cryptoAmount.toFixed(4)} ${deal?.currency || 'TON'} ]`}
              </button>
              {/* Manual fallback */}
              <button className="btn btn-full"
                onClick={() => {
                  navigator.clipboard.writeText(deployed.tonContractAddress);
                  tg?.HapticFeedback?.notificationOccurred('success');
                  toast.success('Address copied!');
                }}
                style={{ fontSize: '7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                [ 📋 COPY ADDRESS (MANUAL) ]
              </button>
            </>
          )}

          <button className="btn btn-gr btn-full" style={{ fontSize: '7px' }}
            onClick={() => navigate(`/deal/${id}`)}>
            [ ◀ BACK TO DEAL ]
          </button>
        </div>
      ) : (
        /* Deploy button */
        hasWallet && (
          <div className="gl card-stagger-3">
            <div className="pxgrid" /><div className="sh" />
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>YOUR WALLET</div>
            <div style={{
              fontSize: '7px', color: '#00ff88', wordBreak: 'break-all',
              padding: '8px 10px', background: 'rgba(0,255,136,0.06)',
              border: '1px solid rgba(0,255,136,0.15)', borderRadius: '8px',
            }}>
              ✅ {profile?.ton_wallet_address?.slice(0, 10)}...{profile?.ton_wallet_address?.slice(-6)}
            </div>

            <button className="btn btn-y btn-full"
              onClick={handleDeploy}
              disabled={loading}
              style={{ marginTop: '14px' }}>
              {loading ? '[ ⏳ DEPLOYING... ]' : '[ 🚀 DEPLOY CONTRACT ]'}
            </button>
            <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: '8px', lineHeight: '1.8' }}>
              SMART CONTRACT WILL BE CREATED ON TON BLOCKCHAIN
            </div>
          </div>
        )
      )}
    </div>
  );
}
