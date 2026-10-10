import type { Card as CardType } from '@twenty-eight/engine';
import { SUIT_NAME, SUIT_SYMBOL, isRedSuit } from '../utils/cards';

// Points each rank is worth in 28, shown as small gold dots under the corner
// index so newer players can see at a glance which cards matter.
const RANK_POINTS: Partial<Record<CardType['rank'], number>> = { J: 3, '9': 2, A: 1, '10': 1 };
const COURT = new Set<CardType['rank']>(['J', 'Q', 'K']);

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  disabled?: boolean;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

function Corner({ card, position }: { card: CardType; position: 'top' | 'bottom' }) {
  const points = RANK_POINTS[card.rank] ?? 0;
  return (
    <span className={`card-corner ${position}`} aria-hidden="true">
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{SUIT_SYMBOL[card.suit]}</span>
      {points > 0 && <span className="card-points">{'•'.repeat(points)}</span>}
    </span>
  );
}

export function PlayingCard({ card, faceDown, disabled, selected, size = 'md', onClick }: CardProps) {
  if (faceDown) {
    return <div className={`card card-back size-${size}`} aria-label="face-down card" />;
  }
  const red = isRedSuit(card.suit);
  const court = COURT.has(card.rank);
  return (
    <button
      type="button"
      className={`card size-${size} ${red ? 'red' : 'black'} ${court ? 'card-court' : ''} ${disabled ? 'disabled' : ''} ${
        selected ? 'selected' : ''
      } ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={`${card.rank} of ${SUIT_NAME[card.suit]}`}
    >
      <Corner card={card} position="top" />
      {court ? (
        <span className="card-court-panel" aria-hidden="true">
          <span className="card-court-letter">{card.rank}</span>
          <span className="card-court-suit">{SUIT_SYMBOL[card.suit]}</span>
        </span>
      ) : (
        <span className="card-pip" aria-hidden="true">
          {SUIT_SYMBOL[card.suit]}
        </span>
      )}
      <Corner card={card} position="bottom" />
    </button>
  );
}
