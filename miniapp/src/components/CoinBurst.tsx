import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  size: number;
}

interface CoinBurstProps {
  trigger: boolean;
  originX?: number;
  originY?: number;
  color?: string;
  count?: number;
}

export function CoinBurst({ trigger, originX = 50, originY = 50, color = '#ffaa00', count = 12 }: CoinBurstProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      return {
        id: Date.now() + i,
        x: originX,
        y: originY,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed - 40,
        color: i % 3 === 0 ? '#ffdd44' : i % 3 === 1 ? color : '#ff8800',
        size: 6 + Math.random() * 6,
      };
    });
    setParticles(newParticles);
    const t = setTimeout(() => setParticles([]), 900);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!particles.length) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 999 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: p.size,
          height: p.size,
          borderRadius: '50%',
          background: p.color,
          boxShadow: `0 0 ${p.size}px ${p.color}`,
          // @ts-ignore
          '--dx': `${p.dx}px`,
          '--dy': `${p.dy}px`,
          animation: 'coin-fly 0.8s ease-out forwards',
        }} />
      ))}
    </div>
  );
}
