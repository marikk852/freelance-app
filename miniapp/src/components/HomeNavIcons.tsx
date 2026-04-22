// ── Home NavCard pixel art icons — SVG with 3D extrusion ──────────────────

type Palette = Record<string, string>;

const DEPTH = 1;

function PixelIcon({ grid, palette, size = 64 }: {
  grid: string[];
  palette: Palette;
  size?: number;
}) {
  const cols = grid[0]?.length ?? 14;
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
      if (!has(x+1, y)) rects.push(<rect key={`r${x},${y}`}  x={x+1} y={y}   width={DEPTH} height={1}     fill={col} opacity={0.48}/>);
      if (!has(x, y+1)) rects.push(<rect key={`bt${x},${y}`} x={x}   y={y+1} width={1}     height={DEPTH} fill={col} opacity={0.36}/>);
      rects.push(<rect key={`f${x},${y}`} x={x} y={y} width={1} height={1} fill={col}/>);
    })
  );

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${cols + DEPTH} ${rows + DEPTH}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges', display: 'block' }}
    >
      {rects}
    </svg>
  );
}

// ── MY DEALS — green circle with white checkmark ───────────────────────────
export function DealsIcon({ size }: { size?: number }) {
  return (
    <PixelIcon size={size} palette={{ '1': '#00ff88', 'd': '#00aa55', 'w': '#ffffff' }} grid={[
      '..............',
      '....dddddd....',
      '...d111111d...',
      '..d11111111d..',
      '..d111111w1d..',
      '..d1w111w11d..',
      '..d11w1w111d..',
      '..d111w1111d..',
      '..d11111111d..',
      '...d111111d...',
      '....dddddd....',
      '..............',
      '..............',
      '..............',
    ]} />
  );
}

// ── NEW DEAL — gold contract scroll ───────────────────────────────────────
export function NewDealIcon({ size }: { size?: number }) {
  return (
    <PixelIcon size={size} palette={{ '1': '#ffaa00', 'd': '#cc7700', 'w': '#ffffff', 'r': '#ffdd88' }} grid={[
      '..............',
      '....r11111r...',
      '...1w......1..',
      '...1.dddddd1..',
      '...1......1...',
      '...1.dddddd1..',
      '...1......1...',
      '...1.dddddd1..',
      '...1......1...',
      '...1.dddddd1..',
      '...1......1...',
      '....r11111r...',
      '..............',
      '..............',
    ]} />
  );
}

// ── LIVE FEED — broadcast antenna + signal arcs ────────────────────────────
export function LiveFeedIcon({ size }: { size?: number }) {
  return (
    <PixelIcon size={size} palette={{ '1': '#0088ff', 'G': '#00ff88', 'B': '#44aaff', 'r': '#ff3333' }} grid={[
      '.......r......',
      '.....G...G....',
      '....G.....G...',
      '...B.......B..',
      '.......1......',
      '.......1......',
      '.......1......',
      '.......1......',
      '.......1......',
      '.......1......',
      '.......1......',
      '.....11111....',
      '....1111111...',
      '..............',
    ]} />
  );
}

// ── JOB BOARD — purple briefcase ──────────────────────────────────────────
export function JobBoardIcon({ size }: { size?: number }) {
  return (
    <PixelIcon size={size} palette={{ '1': '#cc44ff', 'h': '#9922cc', 'd': '#8800cc' }} grid={[
      '..............',
      '.....hhh......',
      '.....h.h......',
      '..d111111111..',
      '..d1.......1..',
      '..d1.......1..',
      '..d111111111..',
      '..d1.......1..',
      '..d1.......1..',
      '..d111111111..',
      '..............',
      '..............',
      '..............',
      '..............',
    ]} />
  );
}

// ── FREELANCERS — magnifying glass (find a pro) ────────────────────────────
export function FreelancerIcon({ size }: { size?: number }) {
  return (
    <PixelIcon size={size} palette={{ 'd': '#0088ff', '1': '#001833' }} grid={[
      '..............',
      '....dddd......',
      '...d1111d.....',
      '..d111111d....',
      '..d111111d....',
      '..d111111d....',
      '...d1111d.....',
      '....ddddd.....',
      '.........dd...',
      '..........dd..',
      '...........dd.',
      '..............',
      '..............',
      '..............',
    ]} />
  );
}
