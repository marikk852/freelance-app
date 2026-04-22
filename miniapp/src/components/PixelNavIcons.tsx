// ============================================================
// Pixel Art 3D Icons — 16×16 grid with depth extrusion
// Front face (100%) + right side (55%) + bottom side (40%) + back shadow (15%)
// Color via CSS currentColor — active=green, inactive=dim white
// ============================================================

const DEPTH = 2; // pixels of 3D extrusion

function Pixel3DIcon({ grid, size = 23 }: { grid: string[]; size?: number }) {
  const GW = grid[0]?.length ?? 16;
  const GH = grid.length;
  const VW = GW + DEPTH;
  const VH = GH + DEPTH;

  // Build filled set for O(1) adjacency lookup
  const filled = new Set<string>();
  const cells: { x: number; y: number }[] = [];
  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '1') { filled.add(`${x},${y}`); cells.push({ x, y }); }
    })
  );
  const has = (x: number, y: number) => filled.has(`${x},${y}`);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges', display: 'block' }}
    >
      {/* ── LAYER 1: Back shadow ── */}
      {cells.map(({ x, y }) => (
        <rect key={`b${x},${y}`} x={x + DEPTH} y={y + DEPTH} width={1} height={1}
          fill="currentColor" opacity={0.15} />
      ))}

      {/* ── LAYER 2: Right face (exposed right edges → diagonal depth) ── */}
      {cells.flatMap(({ x, y }) => {
        if (has(x + 1, y)) return [];
        return [
          <rect key={`r0-${x},${y}`} x={x + 1} y={y} width={1} height={1}
            fill="currentColor" opacity={0.55} />,
          <rect key={`r1-${x},${y}`} x={x + 2} y={y + 1} width={1} height={1}
            fill="currentColor" opacity={0.32} />,
        ];
      })}

      {/* ── LAYER 3: Bottom face (exposed bottom edges → diagonal depth) ── */}
      {cells.flatMap(({ x, y }) => {
        if (has(x, y + 1)) return [];
        return [
          <rect key={`bt0-${x},${y}`} x={x} y={y + 1} width={1} height={1}
            fill="currentColor" opacity={0.42} />,
          <rect key={`bt1-${x},${y}`} x={x + 1} y={y + 2} width={1} height={1}
            fill="currentColor" opacity={0.22} />,
        ];
      })}

      {/* ── LAYER 4: Front face (top, full color) ── */}
      {cells.map(({ x, y }) => (
        <rect key={`f${x},${y}`} x={x} y={y} width={1} height={1}
          fill="currentColor" />
      ))}
    </svg>
  );
}

// ── HOME — house with chimney, pitched roof, walls, door ─────────────────
const HOME_GRID = [
  '0000000000000000',
  '0000001100000000', // chimney
  '0000001100000000', // chimney
  '0000011110000000', // roof peak
  '0000111111000000', // roof
  '0001111111100000', // roof
  '0011111111110000', // roof base (widest)
  '0001111111110000', // wall plate (eave)
  '0001100000110000', // walls
  '0001100000110000', // walls
  '0001100110110000', // walls + door
  '0001100110110000', // walls + door
  '0001100110110000', // walls + door
  '0001111111110000', // floor
  '0000000000000000',
  '0000000000000000',
];

// ── LIVE — broadcast antenna + 3 signal rings + stand ───────────────────
const LIVE_GRID = [
  '0000000000000000',
  '0011000000001100', // signal outer
  '0000110000110000', // signal mid
  '0000001001000000', // signal inner
  '0000000110000000', // antenna tip
  '0000000110000000', // pole
  '0000000110000000', // pole
  '0000000110000000', // pole
  '0000001111000000', // pole base
  '0000000110000000', // stem
  '0000000110000000', // stem
  '0000011111100000', // stand
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

// ── JOBS — briefcase with handle, divider, center latch ─────────────────
const JOBS_GRID = [
  '0000000000000000',
  '0000011110000000', // handle top
  '0000010010000000', // handle sides
  '0001111111110000', // case top
  '0001000000010000', // case sides
  '0001111111110000', // divider
  '0001000110010000', // sides + latch
  '0001000000010000', // sides
  '0001000000010000', // sides
  '0001111111110000', // case bottom
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

// ── PROFILE — classic person silhouette: round head + neck + shoulders ───
const PROFILE_GRID = [
  '0000000000000000',
  '0000011111000000', // head top
  '0000111111100000', // head
  '0000111111100000', // head (face)
  '0000111111100000', // head
  '0000011111000000', // chin
  '0000001110000000', // neck
  '0001111111110000', // shoulders
  '0011111111111000', // chest wide
  '0011111111111000', // chest
  '0001111111110000', // torso
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
  '0000000000000000',
];

export const HomeIcon    = ({ size }: { size?: number }) => <Pixel3DIcon grid={HOME_GRID}    size={size} />;
export const LiveIcon    = ({ size }: { size?: number }) => <Pixel3DIcon grid={LIVE_GRID}    size={size} />;
export const JobsIcon    = ({ size }: { size?: number }) => <Pixel3DIcon grid={JOBS_GRID}    size={size} />;
export const ProfileIcon = ({ size }: { size?: number }) => <Pixel3DIcon grid={PROFILE_GRID} size={size} />;
