import type { Card } from '@twenty-eight/engine';
import { PlayingCard } from './Card';

interface HandProps {
  cards: Card[];
  legalCards: Card[];
  canPlay: boolean;
  onPlay: (card: Card) => void;
}

function cardId(c: Card) {
  return `${c.rank}${c.suit}`;
}

export function Hand({ cards, legalCards, canPlay, onPlay }: HandProps) {
  const legalIds = new Set(legalCards.map(cardId));
  return (
    <div className="hand">
      {cards.map((card) => {
        const isLegal = legalIds.has(cardId(card));
        const disabled = !canPlay || !isLegal;
        return (
          <PlayingCard
            key={cardId(card)}
            card={card}
            size="lg"
            disabled={disabled}
            onClick={disabled ? undefined : () => onPlay(card)}
          />
        );
      })}
    </div>
  );
}
