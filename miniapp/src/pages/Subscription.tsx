import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';

const PLANS = [
  {
    key      : 'basic',
    name     : 'Basic',
    price    : 5.99,
    crystals : 15000,
    color    : '#0088ff',
    badge    : '✦',
    features : [
      'Verified badge on your profile',
      'Profile boosted in search results',
      '15,000 Safe Crystals every month',
    ],
  },
  {
    key      : 'pro',
    name     : 'Pro',
    price    : 15.99,
    crystals : 20000,
    color    : '#cc44ff',
    badge    : '✦✦',
    features : [
      'Pro badge on your profile',
      'Profile + job listings boosted',
      '20,000 Safe Crystals every month',
      'Priority support',
    ],
  },
];

export function Subscription() {
  const navigate    = useNavigate();
  const [params]    = useSearchParams();
  const { tg }      = useTelegram();
  const selectedKey = params.get('plan') || null;
  const [plans,     setPlans]     = useState<any[]>(PLANS);
  const [selected,  setSelected]  = useState<string | null>(selectedKey);
  const [loading,   setLoading]   = useState(false);

  // Fetch available plans from backend (respects admin toggle)
  useEffect(() => {
    fetch('/api/subscriptions/plans', {
      headers: { 'X-Telegram-Init-Data': (window as any).Telegram?.WebApp?.initData || '' }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Only show plans that are active
          const activeKeys = data.map((p: any) => p.key);
          setPlans(PLANS.filter(p => activeKeys.includes(p.key)));
        }
      })
      .catch(() => {});
  }, []);

  const handlePurchase = async (planKey: string) => {
    setLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || '';
      const res = await fetch('/api/subscriptions/purchase', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData },
        body   : JSON.stringify({ plan_key: planKey, currency: 'USDT' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      // Open TonConnect / show payment address
      // For now show payment info popup
      const plan = PLANS.find(p => p.key === planKey)!;
      tg?.showPopup?.({
        title  : `Pay $${plan.price} USDT`,
        message: `Send ${data.payment.amount} USDT to:\n${data.payment.to}\n\nMemo: ${data.payment.memo}`,
        buttons: [{ id: 'ok', type: 'ok' }],
      });
    } catch (err: any) {
      tg?.showAlert?.(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page fade-in">
      {/* Header */}
      <div className="gl hud card-stagger-1" style={{ borderColor: 'rgba(204,68,255,0.3)' }}>
        <div className="pxgrid" /><div className="sh" />
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          fontFamily: '"Press Start 2P", monospace', fontSize: '7px', cursor: 'pointer', padding: 0,
        }}>←</button>
        <div className="logo" style={{ fontSize: '10px', color: '#cc44ff' }}>SUBSCRIPTION</div>
        <div style={{ width: '20px' }} />
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '20px 8px 16px' }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
          Level up your account
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
          Get a verified badge, boost your profile<br/>and earn extra Safe Crystals every month
        </div>
      </div>

      {/* Plans */}
      {plans.length === 0 ? (
        <div className="gl" style={{ textAlign: 'center', padding: '32px', marginBottom: '12px' }}>
          <div className="pxgrid" />
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔒</div>
          <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: 'rgba(255,255,255,0.4)' }}>
            SUBSCRIPTIONS UNAVAILABLE
          </div>
        </div>
      ) : (
        plans.map(plan => {
          const isSelected = selected === plan.key;
          return (
            <div
              key={plan.key}
              onClick={() => setSelected(plan.key)}
              className="gl card-stagger-2"
              style={{
                marginBottom   : '10px',
                borderColor    : isSelected ? plan.color : 'rgba(255,255,255,0.1)',
                cursor         : 'pointer',
                background     : isSelected ? `${plan.color}0d` : 'rgba(255,255,255,0.03)',
                transition     : 'border-color 0.2s, background 0.2s',
              }}
            >
              <div className="pxgrid" />
              {/* Plan header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    background: `${plan.color}22`, border: `1px solid ${plan.color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', color: plan.color,
                  }}>
                    {plan.badge}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                      {plan.name}
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                      monthly subscription
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '20px', fontWeight: 700, color: plan.color }}>
                    ${plan.price}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                    / month
                  </div>
                </div>
              </div>

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', zIndex: 2 }}>
                {plan.features.map((f: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
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
                    width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,170,0,0.15)', border: '1px solid rgba(255,170,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', color: '#ffaa00',
                  }}>💎</div>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#ffaa00', fontWeight: 600 }}>
                    +{plan.crystals.toLocaleString()} Safe Crystals on purchase
                  </span>
                </div>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: plan.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', color: '#000', fontWeight: 700, zIndex: 3,
                }}>✓</div>
              )}
            </div>
          );
        })
      )}

      {/* Purchase button */}
      {selected && plans.length > 0 && (
        <button
          onClick={() => handlePurchase(selected)}
          disabled={loading}
          style={{
            width       : '100%',
            padding     : '16px',
            background  : PLANS.find(p => p.key === selected)?.color || '#cc44ff',
            color       : '#fff',
            border      : 'none',
            borderRadius: '14px',
            fontFamily  : 'Inter, sans-serif',
            fontSize    : '15px',
            fontWeight  : 700,
            cursor      : loading ? 'not-allowed' : 'pointer',
            opacity     : loading ? 0.7 : 1,
            marginBottom: '8px',
          }}
        >
          {loading ? '⏳ Processing...' : `Subscribe to ${PLANS.find(p => p.key === selected)?.name} — $${PLANS.find(p => p.key === selected)?.price}/mo`}
        </button>
      )}

      <div style={{
        fontFamily: 'Inter, sans-serif', fontSize: '10px',
        color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '8px 0 20px',
      }}>
        Payment via USDT (TON network) · Cancel anytime
      </div>
    </div>
  );
}
