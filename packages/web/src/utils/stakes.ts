import { bidTierStake } from '@twenty-eight/engine';

// Human-readable stake for a bid tier, or null when it is a plain single-card
// round. Shared by the round-end and match-end overlays.
export function stakeLabel(bid: number): string | null {
  const stake = bidTierStake(bid);
  if (stake === 4) return `24+ bid — quadruple (×4)`;
  if (stake === 2) return `20+ bid — double (×2)`;
  return null;
}
