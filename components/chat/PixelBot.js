/**
 * Il robottino della chat, disegnato a pixel su una griglia 16 × 16.
 * Ogni carattere della mappa è un pixel: o corpo, d occhi, l lucina dell'antenna, . vuoto.
 */

const MAP = [
  '.......ll.......',
  '.......oo.......',
  '...oooooooooo...',
  '..oooooooooooo..',
  '..ooddooooddoo..',
  '..ooddooooddoo..',
  '..oooooooooooo..',
  '..oooodddddooo..',
  '...oooooooooo...',
  '......oooo......',
  '..oooooooooooo..',
  '.o.oooooooooo.o.',
  '.o.oooooooooo.o.',
  '...oooooooooo...',
  '...oo......oo...',
  '...oo......oo...',
];

const COLORS = { o: '#D97757', d: '#2B1D17', l: '#F5C26B' };

/** Un rettangolo per ogni tratto orizzontale dello stesso colore: meno nodi nell'SVG. */
const RECTS = MAP.flatMap((row, y) => {
  const out = [];
  let x = 0;
  while (x < row.length) {
    const c = row[x];
    let w = 1;
    while (row[x + w] === c) w += 1;
    if (COLORS[c]) out.push({ x, y, w, fill: COLORS[c] });
    x += w;
  }
  return out;
});

/** @param {{ size?: number, className?: string }} props */
export default function PixelBot({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {RECTS.map((r) => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
    </svg>
  );
}
