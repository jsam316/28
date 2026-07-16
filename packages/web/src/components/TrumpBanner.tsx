import type { Suit } from '@twenty-eight/engine';
import { suitName, suitSymbol } from './Card';

interface TrumpBannerProps {
  suit: Suit;
}

export function TrumpBanner({ suit }: TrumpBannerProps) {
  const isRed = suit === 'H' || suit === 'D';
  return (
    <div className="trump-banner">
      <span className={`trump-banner-suit ${isRed ? 'red' : 'black'}`}>{suitSymbol(suit)}</span>
      <span className="trump-banner-label">Trump is {suitName(suit)}</span>
    </div>
  );
}
