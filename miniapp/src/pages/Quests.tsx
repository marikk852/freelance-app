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
  const [quests,   setQuests]   = useState<Quest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [newlyDone, setNewlyDone] = useState<string[]>([]);
  const [filter,   setFilter]   = useState<string>('all');

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
      toast.success(`+${res.data.coins} SafeCoins earned!`, { duration: 3000 });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Requirements not met yet';
      toast.error(msg, { duration: 2500 });
    } finally {
      setClaiming(null);
    }
  }

  const filtered = filter === 'all'
    ? quests
    : quests.filter(q => q.category === filter);

  const completedCount = quests.filter(q => q.completed).length;
  const totalCoins     = quests.filter(q => q.completed).reduce((s, q) => s + q.coins, 0);
  const maxCoins       = quests.reduce((s, q) => s + q.coins, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: '90px' }}>

      {/* Header */}
      <div style={{
        padding: '20px 16px 0',
        fontFamily: '"Press Start 2P", monospace',
      }}>
        <div style={{ fontSize: '13px', color: '#FFAA00', marginBottom: '4px', letterSpacing: '1px' }}>
          QUESTS
        </div>
        <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>
          COMPLETE TASKS — EARN SAFECOINS
        </div>

        {/* Progress summary */}
        <div style={{
          background: 'rgba(255,255,255,0.045)',
          border: '1px solid rgba(255,170,0,0.25)',
          borderRadius: '16px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>COMPLETED</div>
            <div style={{ fontSize: '18px', color: '#FFAA00' }}>{completedCount}<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>/{quests.length}</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>COINS EARNED</div>
            <div style={{ fontSize: '18px', color: '#00FF88' }}>🪙 {totalCoins}<span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>/{maxCoins}</span></div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: '4px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '2px',
          marginBottom: '20px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${quests.length > 0 ? (completedCount / quests.length) * 100 : 0}%`,
            background: 'linear-gradient(90deg, #FFAA00, #00FF88)',
            borderRadius: '2px',
            transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['all', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '6px',
                padding: '6px 12px',
                borderRadius: '100px',
                border: filter === cat ? '1px solid #FFAA00' : '1px solid rgba(255,255,255,0.15)',
                background: filter === cat ? 'rgba(255,170,0,0.15)' : 'transparent',
                color: filter === cat ? '#FFAA00' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {cat === 'all' ? '⚡ ALL' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Quest list */}
      <div style={{ padding: '0 16px', fontFamily: '"Press Start 2P", monospace' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
            LOADING...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
            NO QUESTS
          </div>
        ) : (
          filtered.map(quest => {
            const isNew      = newlyDone.includes(quest.key);
            const isClaiming = claiming === quest.key;
            return (
              <QuestCard
                key={quest.key}
                quest={quest}
                isNew={isNew}
                isClaiming={isClaiming}
                onClaim={() => handleClaim(quest)}
              />
            );
          })
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
      background: done
        ? 'rgba(0,255,136,0.04)'
        : 'rgba(255,255,255,0.045)',
      border: `1px solid ${done ? 'rgba(0,255,136,0.2)' : isNew ? 'rgba(255,170,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: '14px',
      padding: '14px',
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      position: 'relative',
      transition: 'border-color 0.3s',
    }}>

      {/* Icon */}
      <div style={{
        width: '42px',
        height: '42px',
        borderRadius: '12px',
        background: done ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        flexShrink: 0,
      }}>
        {done ? '✅' : quest.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '8px',
          color: done ? 'rgba(255,255,255,0.4)' : '#fff',
          marginBottom: '5px',
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {quest.title}
        </div>
        <div style={{
          fontSize: '6px',
          color: 'rgba(255,255,255,0.35)',
          lineHeight: '1.6',
          marginBottom: '6px',
        }}>
          {quest.description}
        </div>
        <div style={{ fontSize: '7px', color: '#FFAA00' }}>
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
            fontSize: '6px',
            padding: '7px 10px',
            borderRadius: '8px',
            border: '1px solid rgba(0,255,136,0.4)',
            background: isClaiming ? 'rgba(0,255,136,0.05)' : 'rgba(0,255,136,0.12)',
            color: isClaiming ? 'rgba(0,255,136,0.4)' : '#00FF88',
            cursor: isClaiming ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {isClaiming ? '...' : 'CLAIM'}
        </button>
      )}

      {/* NEW badge */}
      {isNew && !done && (
        <div style={{
          position: 'absolute',
          top: '-6px',
          right: '10px',
          background: '#FFAA00',
          color: '#000',
          fontSize: '5px',
          padding: '2px 6px',
          borderRadius: '4px',
          fontFamily: '"Press Start 2P", monospace',
        }}>
          NEW
        </div>
      )}
    </div>
  );
}
