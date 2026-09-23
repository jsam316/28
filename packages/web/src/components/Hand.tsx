import type { Card, Suit } from '@twenty-eight/engine';
import { PlayingCard } from './Card';

interface HandProps {
  cards: Card[];
  legalCards: Card[];
  canPlay: boolean;
  // Cards of this suit get a glow: the trumps you could cut or ruff with.
  highlightSuit?: Suit | null;
  onPlay: (card: Card) => void;
}

function cardId(c: Card) {
  return `${c.rank}${c.suit}`;
}

export function Hand({ cards, legalCards, canPlay, highlightSuit = null, onPlay }: HandProps) {
  const legalIds = new Set(legalCards.map(cardId));
  return (
    <div className="hand" role="group" aria-label={canPlay ? 'Your hand - choose a card to play' : 'Your hand'}>
      {cards.map((card, i) => {
        const isLegal = legalIds.has(cardId(card));
        const disabled = !canPlay || !isLegal;
        const highlight = !disabled && highlightSuit !== null && card.suit === highlightSuit;
        return (
          <span key={cardId(card)} className={`hand-slot ${highlight ? 'hand-slot-trump' : ''}`}>
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
