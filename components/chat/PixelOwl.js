/**
 * Il gufo dell'assistente, disegnato a pixel su una griglia 24 × 24: occhiali e calcolatrice,
 * perché l'assistente fa i conti. Ogni carattere della mappa è un pixel; «.» è trasparente.
 */

const MAP = [
  '...KK..............KK...',
  '...KBK............KBK...',
  '...KBBK..........KBBK...',
  '..KBBBBKKKKKKKKKKBBBBK..',
  '..KBBbBBBBBBBBBBBBbBBK..',
  '.KBBLLLLLLBBBBLLLLLLBBK.',
  '.KBLLLLLLLLBBLLLLLLLLBK.',
  '.KBLKKKKKLLLLLLKKKKKLBK.',
  '.KBKCWCCCKKKKKKCWCCCKBK.',
  '.KBKCCPPCKLLLLKCCPPCKBK.',
  '.KBKCCPPCKLOOLKCCPPCKBK.',
  '.KBLKKKKKLLOOLLKKKKKLBK.',
  '.KBBLLLLLLLLOLLLLLLLBBK.',
  '..KBBLLLLLLLLLLLLLLBBK..',
  '.KBbBLLLLLLLLKKKKKKKBBK.',
  '.KBbBLLlLLLLLKDDDDDKBBK.',
  '.KBbBLLLLLlLLKDDDDDKBBK.',
  '.KBbBLlLLLLLLKSSSSSKBBK.',
  '.KBbBLLLLlLLLKsSsBBBBBK.',
  '.KBbBLLlLLLLLKSsSBBBBBK.',
  '..KbBLLLLLlLLKsSsSBBBK..',
  '..KBBLLLLLLLLKKKKKKKKK..',
  '...KKYYKKKKYYKKK........',
  '....KYKYK.KYKYK.........',
];

const COLORS = {
  K: '#3B2416', // contorno
  B: '#8B5A2B', // piume
  b: '#6B4220', // piume in ombra
  L: '#F2D9B3', // viso e petto
  l: '#E0BC8A', // petto in ombra
  C: '#A7DDF2', // lenti
  W: '#FFFFFF', // riflesso
  P: '#1E1E1E', // pupille
  O: '#F2A01F', // becco
  Y: '#F2B21F', // zampe
  D: '#8BC34A', // display
  S: '#4B5563', // calcolatrice
  s: '#9CA3AF', // tasti
};

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
export default function PixelOwl({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {RECTS.map((r) => <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
    </svg>
  );
}
