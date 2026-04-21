// ============================================================
// Home NavCard Pixel Art Icons — 20×20 grid, multi-color
// ColorPixelIcon: palette map (char → hex) for rich coloring
// Rendered at 48px with crisp pixel rendering
// ============================================================

type Palette = Record<string, string>;

function ColorPixelIcon({ grid, palette, size = 48 }: {
  grid: string[];
  palette: Palette;
  size?: number;
}) {
  const GW = grid[0]?.length ?? 20;
  const GH = grid.length;
  const DEPTH = 2;
  const VW = GW + DEPTH;
  const VH = GH + DEPTH;

  // Build filled map: coord → color char
  const filledMap = new Map<string, string>();
  const cells: { x: number; y: number; ch: string }[] = [];

  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '.' && ch !== '0') {
        const key = `${x},${y}`;
        filledMap.set(key, ch);
        cells.push({ x, y, ch });
      }
    })
  );

  const getColor = (ch: string) => palette[ch] ?? '#ffffff';
  const has = (x: number, y: number) => filledMap.has(`${x},${y}`);
  const getNeighborColor = (x: number, y: number) => {
    const ch = filledMap.get(`${x},${y}`);
    return ch ? getColor(ch) : null;
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges', display: 'block' }}
    >
      {/* ── LAYER 1: Back shadow ── */}
      {cells.map(({ x, y, ch }) => (
        <rect key={`b${x},${y}`} x={x + DEPTH} y={y + DEPTH} width={1} height={1}
          fill={getColor(ch)} opacity={0.12} />
      ))}

      {/* ── LAYER 2: Right face ── */}
      {cells.flatMap(({ x, y, ch }) => {
        if (has(x + 1, y)) return [];
        const c = getColor(ch);
        return [
          <rect key={`r0-${x},${y}`} x={x + 1} y={y} width={1} height={1}
            fill={c} opacity={0.5} />,
          <rect key={`r1-${x},${y}`} x={x + 2} y={y + 1} width={1} height={1}
            fill={c} opacity={0.28} />,
        ];
      })}

      {/* ── LAYER 3: Bottom face ── */}
      {cells.flatMap(({ x, y, ch }) => {
        if (has(x, y + 1)) return [];
        const c = getColor(ch);
        return [
          <rect key={`bt0-${x},${y}`} x={x} y={y + 1} width={1} height={1}
            fill={c} opacity={0.38} />,
          <rect key={`bt1-${x},${y}`} x={x + 1} y={y + 2} width={1} height={1}
            fill={c} opacity={0.2} />,
        ];
      })}

      {/* ── LAYER 4: Front face ── */}
      {cells.map(({ x, y, ch }) => (
        <rect key={`f${x},${y}`} x={x} y={y} width={1} height={1}
          fill={getColor(ch)} />
      ))}
    </svg>
  );
}

// ── MY DEALS — crossed swords with green blades + gold guards ────────────
// 20×20 grid
const DEALS_PALETTE: Palette = {
  G: '#00ff88', // blade green
  g: '#00cc66', // blade shadow
  Y: '#ffdd44', // guard gold
  y: '#cc9900', // guard shadow
  W: '#ffffff', // blade shine
  S: '#888888', // steel hilt
  s: '#555555', // hilt shadow
  R: '#ff4444', // ruby gem
};
const DEALS_GRID = [
  '....................',
  '....G..........g....',
  '....GW........gg....',
  '.....GW......gg.....',
  '......GW....gg......',
  '.......YYY.gg.......',
  '........YRY.........',
  '.......YYY.GG.......',
  '......gg....GW......',
  '.....gg......GW.....',
  '....gg........GW....',
  '...gg..........G....',
  '..gS............Sg..',
  '..SS............SS..',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
];

// ── NEW DEAL — magic wand with star burst + sparkles ─────────────────────
const NEWDEAL_PALETTE: Palette = {
  Y: '#ffdd00', // star gold
  y: '#cc9900', // star shadow
  W: '#ffffff', // sparkle white
  P: '#cc44ff', // magic purple
  p: '#8800cc', // purple shadow
  B: '#44aaff', // blue accent
  S: '#886600', // wand brown
  s: '#554400', // wand shadow
  O: '#ffaa00', // orange glow
};
const NEWDEAL_GRID = [
  '....................',
  '.....WYW............',
  '......Y.............',
  '.....WYW...W........',
  '...........Y........',
  '........YYYY........',
  '.......YYYYYYY......',
  '......YYYYY.YYY.....',
  '.......YYYYYYY......',
  '........YYY.........',
  '..B......SS.........',
  '.........SS.B.......',
  '..........SS........',
  '...........SS...W...',
  '............SS......',
  '.............SS.....',
  '..W...........SS....',
  '....................',
  '....................',
  '....................',
];

// ── LIVE FEED — satellite dish + signal waves + live dot ─────────────────
const LIVE_PALETTE: Palette = {
  B: '#0088ff', // blue dish
  b: '#0055cc', // dish shadow
  W: '#ffffff', // shine
  R: '#ff3333', // live red dot
  G: '#00ff88', // signal green
  g: '#00aa55', // signal shadow
  S: '#888888', // steel pole
  s: '#555555', // pole shadow
  Y: '#ffdd44', // signal tip
};
const LIVE_GRID = [
  '....................',
  '..........R.........',
  '........GgGg........',
  '.......G....Gg......',
  '......G......Gg.....',
  '.....BBb......g.....',
  '....BBBb............',
  '....BBBb............',
  '.....BBb............',
  '......BBb...........',
  '.......Sb...........',
  '.......SS...........',
  '.......SS...........',
  '.....SSSSS..........',
  '....SSSSSSS.........',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
];

// ── JOB BOARD — bulletin board with pinned notes + tack ──────────────────
const JOBS_PALETTE: Palette = {
  N: '#ddbb88', // board natural wood
  n: '#aa8855', // wood shadow
  W: '#fffff0', // paper white
  w: '#ddddcc', // paper shadow
  R: '#ff4444', // red tack
  r: '#cc2222', // tack shadow
  B: '#4488ff', // blue note
  G: '#44cc66', // green note
  Y: '#ffcc00', // yellow highlight
  S: '#664422', // frame dark
};
const JOBS_GRID = [
  '....................',
  '.SSSSSSSSSSSSSSSSSS.',
  '.SNNNNNNNNNNNNNNNNS.',
  '.SN.WWWWW.WWWWWW.NS.',
  '.SN.WRW.W.WBWWWW.NS.',
  '.SN.WWWWW.WWWWWW.NS.',
  '.SN.WWWWW.WWWWWW.NS.',
  '.SN..........YWWW.NS.',
  '.SN.GGGGG..WWWWWW.NS.',
  '.SN.GGGGG..WWWWWW.NS.',
  '.SN.GGGGG..WWWWWW.NS.',
  '.SN.GGGGG..........NS.',
  '.SNNNNNNNNNNNNNNNNS.',
  '.SSSSSSSSSSSSSSSSSS.',
  '........SS..........',
  '........SS..........',
  '....................',
  '....................',
  '....................',
  '....................',
];

// ── FREELANCERS — pixel person with laptop + code glow ───────────────────
const FREELANCER_PALETTE: Palette = {
  F: '#ffcc88', // skin
  f: '#cc9955', // skin shadow
  H: '#334499', // hair blue-dark
  h: '#223377', // hair shadow
  S: '#4488ff', // shirt blue
  s: '#2255cc', // shirt shadow
  L: '#222222', // laptop dark
  l: '#111111', // laptop shadow
  G: '#00ff88', // screen green glow
  g: '#00aa55', // screen shadow
  W: '#ffffff', // screen white
  Y: '#ffdd00', // keyboard yellow
};
const FREELANCER_GRID = [
  '....................',
  '.......HHH..........',
  '......HHHHH.........',
  '......HfFfH.........',
  '......HFFFH.........',
  '.......HHH..........',
  '.......SSS..........',
  '......SSSSS.........',
  '......SSSSS.........',
  '.......SSS..........',
  '....LLLLLLLLL.......',
  '....LGGGGGWGL.......',
  '....LGGGGGGGL.......',
  '....LLLLLLLLL.......',
  '....lYYYYYYYll......',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
];

export function DealsIcon({ size }: { size?: number }) {
  return <ColorPixelIcon grid={DEALS_GRID} palette={DEALS_PALETTE} size={size} />;
}
export function NewDealIcon({ size }: { size?: number }) {
  return <ColorPixelIcon grid={NEWDEAL_GRID} palette={NEWDEAL_PALETTE} size={size} />;
}
export function LiveFeedIcon({ size }: { size?: number }) {
  return <ColorPixelIcon grid={LIVE_GRID} palette={LIVE_PALETTE} size={size} />;
}
export function JobBoardIcon({ size }: { size?: number }) {
  return <ColorPixelIcon grid={JOBS_GRID} palette={JOBS_PALETTE} size={size} />;
}
export function FreelancerIcon({ size }: { size?: number }) {
  return <ColorPixelIcon grid={FREELANCER_GRID} palette={FREELANCER_PALETTE} size={size} />;
}
