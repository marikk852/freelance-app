import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useTelegram } from '../hooks/useTelegram';
import { PixelScene } from '../components/PixelScene';
import toast from 'react-hot-toast';

const PLANS = [
  {
    key      : 'basic',
    name     : 'BASIC',
    price    : 5.99,
    crystals : 15000,
    color    : '#0088ff',
    badge    : '✦',
    popular  : false,
    features : [
      'Verified badge on your profile',
      'Profile boosted in search results',
      '15,000 Safe Crystals every month',
    ],
  },
  {
    key      : 'pro',
    name     : 'PRO',
    price    : 15.99,
    crystals : 20000,
    color    : '#cc44ff',
    badge    : '✦✦',
    popular  : true,
    features : [
      'Pro badge on your profile',
      'Profile + job listings boosted',
      '20,000 Safe Crystals every month',
      'Priority support',
    ],
  },
];

type Plan = typeof PLANS[number];
// Котировка плана для пользователя (цена/TON/гейтинг по уровню)
type Quote = {
  eligible: boolean;
  is_early?: boolean;
  price_usd?: number;
  ton_amount?: string;
  your_level?: number;
  required_level?: number;
};
// Стадии оплаты: пользователь всегда видит, что происходит сейчас
type PayStage = 'idle' | 'creating' | 'wallet' | 'confirming';

const STAGE_LABEL: Record<PayStage, string> = {
  idle      : '',
  creating  : 'CREATING PAYMENT...',
  wallet    : 'CONFIRM IN WALLET ↗',
  confirming: 'VERIFYING ON-CHAIN...',
};

export function Subscription() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const { tg, initData } = useTelegram();
  const [tonConnectUI] = useTonConnectUI();
  const wallet         = useTonWallet();

  const urlPlan = params.get('plan');
  const [plans, setPlans]           = useState<Plan[]>(PLANS);
  const [plansError, setPlansError] = useState(false);
  // Pro предвыбран: CTA видна сразу, карточки очевидно выбираемые
  const [selected, setSelected] = useState<string>(
    urlPlan && PLANS.some(p => p.key === urlPlan) ? urlPlan : 'pro'
  );
  const [stage, setStage]   = useState<PayStage>('idle');
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  // Отправленная, но не подтверждённая транзакция: повторный тап
  // НЕ создаёт новый платёж, а только перепроверяет этот BOC
  const [pendingTx, setPendingTx] = useState<{ planKey: string; boc: string } | null>(null);

  const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData };

  // Telegram BackButton вместо кастомной стрелки (тач-таргет, деплинки)
  useEffect(() => {
    if (!tg?.BackButton) return;
    tg.BackButton.show();
    const goBack = () => navigate('/profile');
    tg.BackButton.onClick(goBack);
    return () => {
      tg.BackButton.offClick(goBack);
      tg.BackButton.hide();
    };
  }, [tg, navigate]);

  const loadPlans = () => {
    setPlansError(false);
    fetch('/api/subscriptions/plans', { headers: { 'X-Telegram-Init-Data': initData } })
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          const activeKeys = data.map((p: { key: string }) => p.key);
          setPlans(PLANS.filter(p => activeKeys.includes(p.key)));
        }
      })
      .catch(() => setPlansError(true));
  };
  useEffect(loadPlans, []);

  // Котировки (цена, TON, право покупки по уровню) для всех планов —
  // пользователь видит реальную сумму и гейтинг ДО открытия кошелька
  useEffect(() => {
    plans.forEach(plan => {
      if (quotes[plan.key]) return;
      fetch(`/api/subscriptions/quote/${plan.key}`, { headers: { 'X-Telegram-Init-Data': initData } })
        .then(r => (r.ok ? r.json() : null))
        .then((data: Quote | null) => {
          if (data) setQuotes(q => ({ ...q, [plan.key]: data }));
        })
        .catch(() => {});
    });
  }, [plans]);

  const selectPlan = (key: string) => {
    setSelected(key);
    tg?.HapticFeedback?.impactOccurred('light');
  };

  // Подтверждение с авто-ретраем: сеть TON подтверждает транзакцию
  // до ~30 секунд, 402 = "ещё не видна", пробуем сами, юзер ждёт
  const confirmPayment = async (planKey: string, boc: string) => {
    const ATTEMPTS = 6, DELAY_MS = 5000;
    for (let i = 0; i < ATTEMPTS; i++) {
      const res  = await fetch('/api/subscriptions/confirm', {
        method: 'POST', headers,
        body  : JSON.stringify({ plan_key: planKey, tx_hash: boc, currency: 'TON' }),
      });
      if (res.ok) return;
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (res.status !== 402) throw new Error(data.error || 'Confirmation failed');
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
    throw new Error('PENDING');
  };

  const handlePurchase = async (planKey: string) => {
    const plan = PLANS.find(p => p.key === planKey);
    if (!plan) return;

    if (!wallet) {
      tonConnectUI.openModal();
      return;
    }

    try {
      let boc: string;

      if (pendingTx && pendingTx.planKey === planKey) {
        // Уже оплачено, но не подтверждено — только перепроверяем, НЕ платим снова
        boc = pendingTx.boc;
        setStage('confirming');
      } else {
        setStage('creating');
        const res  = await fetch('/api/subscriptions/purchase', {
          method: 'POST', headers,
          body  : JSON.stringify({ plan_key: planKey, currency: 'TON' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create payment');

        const nanoAmount = BigInt(Math.round(parseFloat(data.payment.amount) * 1e9)).toString();

        setStage('wallet');
        const tx = await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 600,
          messages  : [{ address: data.payment.to, amount: nanoAmount }],
        });
        boc = tx.boc;
        setPendingTx({ planKey, boc });
        tg?.HapticFeedback?.notificationOccurred('success');
        setStage('confirming');
      }

      await confirmPayment(planKey, boc);

      setPendingTx(null);
      setStage('idle');
      tg?.HapticFeedback?.notificationOccurred('success');
      toast.success(`✓ ${plan.name} subscription activated!`);
      setTimeout(() => navigate('/profile'), 1500);
    } catch (err) {
      setStage('idle');
      const msg = err instanceof Error ? err.message : 'Payment failed';
      if (msg === 'PENDING') {
        // Деньги отправлены — pendingTx сохранён, кнопка станет CHECK STATUS
        toast('⏳ Network is still confirming your payment. Tap CHECK STATUS in a minute — you will NOT be charged twice.', { duration: 6000 });
        return;
      }
      tg?.HapticFeedback?.notificationOccurred('error');
      if (msg.includes('User declined') || msg.includes('Reject')) {
        toast.error('Payment cancelled');
      } else {
        toast.error(msg);
      }
    }
  };

  const selPlan   = plans.find(p => p.key === selected);
  const selQuote  = quotes[selected];
  const selLocked = selQuote ? selQuote.eligible === false : false;
  const isPending = pendingTx !== null && pendingTx.planKey === selected;
  const busy      = stage !== 'idle';

  return (
    <div className="page fade-in">
      <div className="sub-wrap">
        {/* Header */}
        <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(204,68,255,0.3)', justifyContent: 'center' }}>
          <div className="pxgrid" /><div className="sh" />
          <div className="logo" style={{ fontSize: '10px', color: '#cc44ff' }}>SUBSCRIPTION</div>
        </div>

        {/* Hero — pixel retrofuturism */}
        <div style={{ textAlign: 'center', padding: '16px 8px 14px' }}>
          <PixelScene scene="subscription" />
          <div className="px" style={{
            fontSize: '12px', color: '#cc44ff', marginBottom: '10px',
            textShadow: '0 0 10px rgba(204,68,255,0.8), 0 0 28px rgba(204,68,255,0.4)',
          }}>
            LEVEL UP
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Verified badge, boosted profile<br/>and Safe Crystals every month
          </div>
        </div>

        {/* Plans load error */}
        {plansError && (
          <div className="gl" style={{ padding: '12px', marginBottom: '10px', borderColor: 'rgba(255,136,0,0.35)', textAlign: 'center' }}>
            <div className="pxgrid" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ff8800' }}>
              Could not check plan availability.{' '}
            </span>
            <button onClick={loadPlans} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
              fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ffaa00', textDecoration: 'underline',
            }}>Retry</button>
          </div>
        )}

        {/* Plans */}
        {plans.length === 0 && !plansError ? (
          <div className="gl" style={{ textAlign: 'center', padding: '32px', marginBottom: '12px' }}>
            <div className="pxgrid" />
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔒</div>
            <div className="px" style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>
              SUBSCRIPTIONS UNAVAILABLE
            </div>
          </div>
        ) : (
          <div className="sub-plans">
            {plans.map(plan => {
              const isSelected = selected === plan.key;
              const q = quotes[plan.key];
              const locked = q ? q.eligible === false : false;
              return (
                <div
                  key={plan.key}
                  onClick={() => selectPlan(plan.key)}
                  className="gl card-stagger-2"
                  style={{
                    marginBottom: '10px',
                    paddingTop  : plan.popular ? '26px' : undefined,
                    borderColor : isSelected ? plan.color : 'rgba(255,255,255,0.1)',
                    boxShadow   : isSelected ? `0 0 18px ${plan.color}33, inset 0 0 24px ${plan.color}0a` : 'none',
                    cursor      : 'pointer',
                    background  : isSelected ? `${plan.color}0d` : 'rgba(255,255,255,0.03)',
                    transition  : 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
                  }}
                >
                  <div className="pxgrid" />
                  {isSelected && <div className="sh" />}

                  {/* POPULAR pixel ribbon */}
                  {plan.popular && (
                    <div className="px" style={{
                      position: 'absolute', top: '-1px', left: '14px', zIndex: 3,
                      fontSize: '6px', color: '#000', background: plan.color,
                      padding: '4px 8px 5px', borderRadius: '0 0 6px 6px',
                      boxShadow: `0 0 12px ${plan.color}66`,
                    }}>POPULAR</div>
                  )}

                  {/* Plan header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '8px',
                        background: `${plan.color}22`, border: `1px solid ${plan.color}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', color: plan.color,
                        boxShadow: isSelected ? `0 0 10px ${plan.color}44` : 'none',
                      }}>
                        {plan.badge}
                      </div>
                      <div>
                        <div className="px" style={{ fontSize: '10px', color: isSelected ? plan.color : '#fff', marginBottom: '5px' }}>
                          {plan.name}
                        </div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                          monthly subscription
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {locked ? (
                        <>
                          <div className="px" style={{ fontSize: '9px', color: '#ff8800' }}>
                            🔒 LVL {q?.required_level}
                          </div>
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                            your LVL {q?.your_level}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="px" style={{ fontSize: '12px', color: plan.color }}>
                            ${q?.price_usd ?? plan.price}
                          </div>
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                            {q?.ton_amount ? `≈ ${q.ton_amount} TON / mo` : '/ month'}
                          </div>
                          {q?.is_early && (
                            <div className="px" style={{ fontSize: '6px', color: '#ffaa00', marginTop: '4px' }}>
                              EARLY ACCESS
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', zIndex: 2 }}>
                    {plan.features.map((f: string, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                          background: `${plan.color}22`, border: `1px solid ${plan.color}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '8px', color: plan.color,
                        }}>✓</div>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                          {f}
                        </span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                        background: 'rgba(255,170,0,0.15)', border: '1px solid rgba(255,170,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '8px',
                      }}>💎</div>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ffaa00', fontWeight: 600 }}>
                        +{plan.crystals.toLocaleString()} Safe Crystals on purchase
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Purchase CTA — pixel glass button */}
        {selPlan && (
          <button
            onClick={() => { if (!selLocked) handlePurchase(selPlan.key); }}
            disabled={busy || selLocked}
            className="btn"
            style={{
              background  : selLocked
                ? 'rgba(255,255,255,0.06)'
                : `linear-gradient(175deg, ${selPlan.color}, ${selPlan.color}99)`,
              color       : selLocked ? '#ff8800' : '#fff',
              border      : `1px solid ${selLocked ? 'rgba(255,136,0,0.4)' : selPlan.color}`,
              boxShadow   : selLocked ? 'none' : `0 0 16px ${selPlan.color}44`,
              cursor      : (busy || selLocked) ? 'not-allowed' : 'pointer',
              opacity     : busy ? 0.75 : 1,
              textShadow  : selLocked ? 'none' : '0 1px 0 rgba(0,0,0,0.4)',
            }}
          >
            {selLocked
              ? `🔒 UNLOCK AT LVL ${selQuote?.required_level} · YOU ARE LVL ${selQuote?.your_level}`
              : busy
                ? STAGE_LABEL[stage]
                : isPending
                  ? 'CHECK STATUS'
                  : `SUBSCRIBE ${selPlan.name} · $${selQuote?.price_usd ?? selPlan.price}/MO`}
          </button>
        )}

        <div style={{
          fontFamily: 'Inter, sans-serif', fontSize: '10px',
          color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '8px 0 20px',
        }}>
          Payment in TON · converted from USD at live rate · Cancel anytime
        </div>
      </div>
    </div>
  );
}
