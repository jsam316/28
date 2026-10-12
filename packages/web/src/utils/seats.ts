import type { Seat } from '@twenty-eight/engine';

export type TablePosition = 'bottom' | 'left' | 'top' | 'right';

// Where a seat sits on the table relative to the viewer, who is always at the
// bottom. Deal and play go counter-clockwise, so the next seat to act sits on
// the viewer's right.
export function seatPosition(seat: Seat, you: Seat): TablePosition {
  const rel = (seat - you + 4) % 4;
  return (['bottom', 'right', 'top', 'left'] as const)[rel];
}
