import type { Card, Suit } from '@twenty-eight/engine';
import { PlayingCard } from './Card';
import { suitName, suitSymbol } from '../utils/cards';

interface TrumpBannerProps {
  declarerName: string;
  bid: number;
  isDeclarer: boolean;
  suit: Suit | null; // null while concealed from the viewer
  card: Card | null;
  revealed: boolean;
}

// Who holds the bid and what the viewer knows about the trump. Shown to
// everyone during play so a bid that changed hands in the second round is
// never a surprise.
export function TrumpBanner({ declarerName, bid, isDeclarer, suit, card, revealed }: TrumpBannerProps) {
  const isRed = suit === 'H' || suit === 'D';
  const who = isDeclarer ? `You hold the bid at ${bid}` : `${declarerName} holds the bid at ${bid}`;
  let trumpText: string;
  if (revealed && suit) trumpText = `Trump is ${suitName(suit)}`;
  else if (suit) trumpText = `your hidden trump is ${suitName(suit)}`;
  else trumpText = `the trump is ${declarerName}'s secret until someone calls for it`;
  return (
    <div className={`trump-banner ${suit ? '' : 'trump-banner-unknown'}`}>
      {card ? (
        <PlayingCard card={card} size="sm" />
      ) : suit ? (
        <span className={`trump-banner-suit ${isRed ? 'red' : 'black'}`}>{suitSymbol(suit)}</span>
      ) : (
        <span className="trump-banner-suit unknown">?</span>
      )}
      <span className="trump-banner-label">
        {who} · {trumpText}
      </span>
    </div>
  );
}
