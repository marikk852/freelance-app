import { useEffect, useState } from 'react';

export function useCountUp(target: number, duration = 1200, start = 0): number {
  const [value, setValue] = useState(start);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const startTime = performance.now();
    const diff = target - start;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + diff * ease));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, start]);

  return value;
}
