import type { Card } from '@twenty-eight/engine';

// The four suit marks drawn as SVG shapes in a 10x10 box. Font glyphs vary
// from device to device (some phones even draw ♥ and ♦ as emoji), so the card
// faces use these instead and always look the same.
const SHAPES: Record<Card['suit'], string> = {
  H: 'M5 9.4 C3.2 7.9 0.4 5.8 0.4 3.3 C0.4 1.6 1.7 0.4 3.1 0.4 C4 0.4 4.7 0.9 5 1.7 C5.3 0.9 6 0.4 6.9 0.4 C8.3 0.4 9.6 1.6 9.6 3.3 C9.6 5.8 6.8 7.9 5 9.4 Z',
  D: 'M5 0.2 L8.9 5 L5 9.8 L1.1 5 Z',
  S: 'M5 0.3 C3.3 2 0.5 3.9 0.5 6.2 C0.5 7.7 1.6 8.6 2.9 8.6 C3.7 8.6 4.3 8.2 4.7 7.6 C4.6 8.5 4.2 9.2 3.4 9.8 L6.6 9.8 C5.8 9.2 5.4 8.5 5.3 7.6 C5.7 8.2 6.3 8.6 7.1 8.6 C8.4 8.6 9.5 7.7 9.5 6.2 C9.5 3.9 6.7 2 5 0.3 Z',
  // Three leaves (circles drawn as two arcs each, same winding so they merge)
  // and a flared stem.
  C:
    'M2.7 2.7 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0 Z ' +
    'M0.4 6.2 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0 Z ' +
    'M5 6.2 a2.3 2.3 0 1 0 4.6 0 a2.3 2.3 0 1 0 -4.6 0 Z ' +
    'M4.6 5 C4.6 7.6 4.2 9 3.3 9.8 L6.7 9.8 C5.8 9 5.4 7.6 5.4 5 Z',
};

// The bare path, for use inside another SVG (court artwork).
export function SuitPath({ suit, x, y, size, fill }: { suit: Card['suit']; x: number; y: number; size: number; fill: string }) {
  const s = size / 10;
  return <path d={SHAPES[suit]} transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`} fill={fill} />;
}

// A standalone suit mark sized by the surrounding font size and drawn in the
// current text colour.
export function SuitIcon({ suit, className }: { suit: Card['suit']; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 10 10" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path d={SHAPES[suit]} fill="currentColor" />
    </svg>
  );
}
