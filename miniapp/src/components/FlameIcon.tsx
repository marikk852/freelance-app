import { useState, useEffect } from 'react';

// ── Pixel art animated flame — colors shift each frame, tip moves ±1px ──

const BASE_ROWS = [
  '....yoooooy...',
  '...yoooooooy..',
  '...roooooory..',
  '..rrooooorrr..',
  '..rrrrrrrrr...',
  '..rrrrrrrrrr..',
  '...rrrrrrrr...',
  '..............',
  '..............',
];

const TIPS = [
  ['..............','.......w......','......yyy.....', '.....yyyyy....','....yooooy....'],
  ['..............','......w.......', '.....yyy......', '.....yyyyy....','....yooooy....'],
  ['..............','..............','......yyy.....', '.....yyyy.....','....yooooy....'],
  ['..............','........w.....', '.......yyy....', '.....yyyyy....','....yooooy....'],
  ['..............','.......w......','......yyy.....', '.....yyyyy....','....yooooy....'],
];

const FRAMES = TIPS.map(tip => [...tip, ...BASE_ROWS]);

type Palette = Record<string, string>;

function rndPalette(): Palette {
  return {
    w: Math.random() > 0.3  ? '#ffffff' : '#ffffaa',
    y: Math.random() > 0.45 ? '#ffee00' : (Math.random() > 0.5 ? '#ffcc00' : '#ffdd55'),
    o: Math.random() > 0.5  ? '#ff8800' : (Math.random() > 0.5 ? '#ffaa00' : '#ff6600'),
    r: Math.random() > 0.45 ? '#ff3300' : (Math.random() > 0.5 ? '#ff5500' : '#dd2200'),
  };
}

const DEPTH = 1;

export function FlameIcon({ size = 28 }: { size?: number }) {
  const [frame,   setFrame]   = useState(0);
  const [palette, setPalette] = useState<Palette>(rndPalette);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame(f => (f + 1) % FRAMES.length);
      setPalette(rndPalette());
    }, 140);
    return () => clearInterval(id);
  }, []);

  const grid = FRAMES[frame];
  const cols = grid[0].length;
  const rows = grid.length;

  const filled = new Map<string, string>();
  grid.forEach((row, y) =>
    [...row].forEach((c, x) => { if (c !== '.') filled.set(`${x},${y}`, c); })
  );
  const has = (x: number, y: number) => filled.has(`${x},${y}`);
  const clr = (c: string) => palette[c] ?? '#ffffff';

  const rects: React.ReactElement[] = [];
  grid.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.') return;
      const col = clr(c);
      rects.push(<rect key={`b${x},${y}`}  x={x+DEPTH} y={y+DEPTH} width={1} height={1} fill={col} opacity={0.15}/>);
      if (!has(x+1, y)) rects.push(<rect key={`r${x},${y}`}  x={x+1} y={y}      width={DEPTH} height={1}     fill={col} opacity={0.48}/>);
      if (!has(x, y+1)) rects.push(<rect key={`bt${x},${y}`} x={x}   y={y+1}    width={1}     height={DEPTH} fill={col} opacity={0.36}/>);
      rects.push(<rect key={`f${x},${y}`}  x={x} y={y} width={1} height={1} fill={col}/>);
    })
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cols + DEPTH} ${rows + DEPTH}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges', display: 'block' }}
    >
      {rects}
    </svg>
  );
}
