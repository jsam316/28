import type { Seat } from '@twenty-eight/engine';

export type TablePosition = 'bottom' | 'left' | 'top' | 'right';

// Where a seat sits on the table relative to the viewer, who is always at the bottom.
export function seatPosition(seat: Seat, you: Seat): TablePosition {
  const rel = (seat - you + 4) % 4;
  return (['bottom', 'left', 'top', 'right'] as const)[rel];
}
