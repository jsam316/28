import type { Card as CardType, Suit } from '@twenty-eight/engine';

const SUIT_SYMBOL: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

const SUIT_NAME: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
};

function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  disabled?: boolean;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function PlayingCard({ card, faceDown, disabled, selected, size = 'md', onClick }: CardProps) {
  if (faceDown) {
    return <div className={`card card-back size-${size}`} aria-label="face-down card" />;
  }
  const red = isRed(card.suit);
  return (
    <button
      type="button"
      className={`card size-${size} ${red ? 'red' : 'black'} ${disabled ? 'disabled' : ''} ${
        selected ? 'selected' : ''
      } ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={`${card.rank} of ${SUIT_NAME[card.suit]}`}
    >
      <span className="card-corner top">
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="card-pip">{SUIT_SYMBOL[card.suit]}</span>
      <span className="card-corner bottom">
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
    </button>
  );
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOL[suit];
}

export function suitName(suit: Suit): string {
  return SUIT_NAME[suit];
}
