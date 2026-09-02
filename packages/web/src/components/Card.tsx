import type { Card as CardType } from '@twenty-eight/engine';
import { SUIT_NAME, SUIT_SYMBOL, isRedSuit } from '../utils/cards';

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
  const red = isRedSuit(card.suit);
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
