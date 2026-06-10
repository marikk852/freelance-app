import { useEffect, useState } from 'react';
import { quests as questsApi } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

// ============================================================
// Screen: QUESTS — tasks with SafeCoin rewards
// ============================================================

interface Quest {
  id          : number;
  key         : string;
  title       : string;
  description : string;
  coins       : number;
  icon        : string;
  category    : string;
  completed   : boolean;
  completed_at: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: '⚙️ GENERAL',
  deals  : '⚔️ DEALS',
  social : '👥 SOCIAL',
};

const CATEGORIES = ['general', 'deals', 'social'];

export function Quests() {
  const { tg }  = useTelegram();
  const [quests,    setQuests]    = useState<Quest[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [claiming,  setClaiming]  = useState<string | null>(null);
  const [newlyDone, setNewlyDone] = useState<string[]>([]);
  const [filter,    setFilter]    = useState<string>('all');

  useEffect(() => {
    tg?.BackButton?.hide();
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await questsApi.list();
      setQuests(res.data.quests);
      if (res.data.newlyCompleted?.length > 0) {
        const keys = res.data.newlyCompleted.map((q: any) => q.key);
        setNewlyDone(keys);
        res.data.newlyCompleted.forEach((q: any) => {
          toast.success(`+${q.coins} coins — ${q.title}`, { duration: 3000 });
        });
      }
    } catch {
      toast.error('Failed to load quests');
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim(quest: Quest) {
    if (quest.completed || claiming) return;
    tg?.HapticFeedback?.impactOccurred('medium');
    setClaiming(quest.key);
    try {
      const res = await questsApi.claim(quest.key);
      setQuests(prev => prev.map(q => q.key === quest.key ? { ...q, completed: true } : q));
      setNewlyDone(prev => [...prev, quest.key]);
      toast.success(`+${res.data.coins} Safe Crystals earned!`, { duration: 3000 });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Requirements not met yet';
      toast.error(msg, { duration: 2500 });
    } finally {
      setClaiming(null);
    }
  }

  const filtered       = filter === 'all' ? quests : quests.filter(q => q.category === filter);
  const completedCount = quests.filter(q => q.completed).length;
  const totalCoins     = quests.filter(q => q.completed).reduce((s, q) => s + q.coins, 0);
  const maxCoins       = quests.reduce((s, q) => s + q.coins, 0);
  const progressPct    = quests.length > 0 ? (completedCount / quests.length) * 100 : 0;

  return (
    <div className="page fade-in">

      {/* ── Desktop topbar ── */}
      <div className="desktop-topbar desktop-only">
        <div className="desktop-topbar-title">DASHBOARD / <span>QUESTS</span></div>
        <div style={{ fontSize: '6px', color: '#ffaa00', fontFamily: '"Press Start 2P", monospace' }}>
          🪙 {totalCoins}/{maxCoins} COINS
        </div>
        <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Press Start 2P", monospace' }}>
          {completedCount}/{quests.length} DONE
        </div>
      </div>

      <div className="page-inner" style={{ fontFamily: '"Press Start 2P", monospace' }}>

        {/* ── Mobile header ── */}
        <div className="mobile-only">
          <div style={{ fontSize: '13px', color: '#FFAA00', marginBottom: '4px', letterSpacing: '1px' }}>
            QUESTS
          </div>
          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
            COMPLETE TASKS — EARN SAFECOINS
          </div>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {/* Progress card */}
          <div className="gl" style={{
            flex: 1, padding: '14px 16px',
            borderColor: 'rgba(255,170,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div className="pxgrid" /><div className="sh" />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>COMPLETED</div>
              <div style={{ fontSize: '20px', color: '#FFAA00', lineHeight: 1 }}>
                {completedCount}<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>/{quests.length}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>COINS EARNED</div>
              <div style={{ fontSize: '20px', color: '#00FF88', lineHeight: 1 }}>
                🪙 {totalCoins}<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>/{maxCoins}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div style={{
          height: '5px', background: 'rgba(255,255,255,0.08)',
          borderRadius: '3px', marginBottom: '20px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #FFAA00, #00FF88)',
            borderRadius: '3px', transition: 'width 0.6s ease',
          }} />
        </div>

        {/* ── Category filter ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['all', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '6px', padding: '7px 14px', borderRadius: '100px',
                border: filter === cat ? '1px solid #FFAA00' : '1px solid rgba(255,255,255,0.15)',
                background: filter === cat ? 'rgba(255,170,0,0.15)' : 'transparent',
                color: filter === cat ? '#FFAA00' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {cat === 'all' ? '⚡ ALL' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* ── Quest list ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
            LOADING...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
            NO QUESTS
          </div>
        ) : (
          <div className="quests-grid">
            {filtered.map(quest => (
              <QuestCard
                key={quest.key}
                quest={quest}
                isNew={newlyDone.includes(quest.key)}
                isClaiming={claiming === quest.key}
                onClaim={() => handleClaim(quest)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// QuestCard component
// ============================================================
function QuestCard({
  quest, isNew, isClaiming, onClaim,
}: {
  quest: Quest;
  isNew: boolean;
  isClaiming: boolean;
  onClaim: () => void;
}) {
  const done = quest.completed;

  return (
    <div style={{
      background: done ? 'rgba(0,255,136,0.04)' : 'rgba(255,255,255,0.045)',
      border: `1px solid ${done ? 'rgba(0,255,136,0.2)' : isNew ? 'rgba(255,170,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: '14px', padding: '14px', marginBottom: '10px',
      display: 'flex', alignItems: 'center', gap: '12px',
      position: 'relative', transition: 'border-color 0.3s',
    }}>
      {/* Pixel grid */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '14px',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)',
        backgroundSize: '5px 5px', pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        background: done ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '22px', flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        {done ? '✅' : quest.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: '8px', color: done ? 'rgba(255,255,255,0.35)' : '#fff',
          marginBottom: '5px', textDecoration: done ? 'line-through' : 'none',
          fontFamily: '"Press Start 2P", monospace',
        }}>
          {quest.title}
        </div>
        <div style={{
          fontSize: '6px', color: 'rgba(255,255,255,0.35)',
          lineHeight: '1.7', marginBottom: '6px',
          fontFamily: '"Press Start 2P", monospace',
        }}>
          {quest.description}
        </div>
        <div style={{ fontSize: '7px', color: '#FFAA00', fontFamily: '"Press Start 2P", monospace' }}>
          🪙 +{quest.coins} coins
        </div>
      </div>

      {/* Claim button */}
      {!done && (
        <button
          onClick={onClaim}
          disabled={isClaiming}
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '6px', padding: '8px 12px', borderRadius: '8px',
            border: '1px solid rgba(0,255,136,0.4)',
            background: isClaiming ? 'rgba(0,255,136,0.05)' : 'rgba(0,255,136,0.12)',
            color: isClaiming ? 'rgba(0,255,136,0.4)' : '#00FF88',
            cursor: isClaiming ? 'not-allowed' : 'pointer',
            flexShrink: 0, whiteSpace: 'nowrap', position: 'relative', zIndex: 1,
          }}
        >
          {isClaiming ? '...' : 'CLAIM'}
        </button>
      )}

      {/* NEW badge */}
      {isNew && !done && (
        <div style={{
          position: 'absolute', top: '-6px', right: '10px',
          background: '#FFAA00', color: '#000', fontSize: '5px',
          padding: '2px 6px', borderRadius: '4px',
          fontFamily: '"Press Start 2P", monospace',
        }}>
          NEW
        </div>
      )}
    </div>
  );
}
