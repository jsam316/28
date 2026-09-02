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
    <div className="hand" role="group" aria-label={canPlay ? 'Your hand - choose a card to play' : 'Your hand'}>
      {cards.map((card, i) => {
        const isLegal = legalIds.has(cardId(card));
        const disabled = !canPlay || !isLegal;
        return (
          <span key={cardId(card)} className="hand-slot">
            <PlayingCard card={card} size="lg" disabled={disabled} onClick={disabled ? undefined : () => onPlay(card)} />
            {canPlay && !disabled && (
              <kbd className="key-hint hand-key" aria-hidden="true">
                {i + 1}
              </kbd>
            )}
          </span>
        );
      })}
    </div>
  );
}
