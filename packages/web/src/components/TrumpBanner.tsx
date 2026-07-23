import type { Card, Suit } from '@twenty-eight/engine';
import { PlayingCard, suitName, suitSymbol } from './Card';

interface TrumpBannerProps {
  suit: Suit;
  card: Card | null;
  revealed: boolean;
}

export function TrumpBanner({ suit, card, revealed }: TrumpBannerProps) {
  const isRed = suit === 'H' || suit === 'D';
  return (
    <div className="trump-banner">
      {card ? (
        <PlayingCard card={card} size="sm" />
      ) : (
        <span className={`trump-banner-suit ${isRed ? 'red' : 'black'}`}>{suitSymbol(suit)}</span>
      )}
      <span className="trump-banner-label">
        {revealed ? `Trump is ${suitName(suit)}` : `Your hidden trump — ${suitName(suit)}`}
      </span>
    </div>
  );
}
