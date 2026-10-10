import type React from 'react';
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

// Each card's place in the fan: its offset from the middle of the hand.
// CSS turns this into a slight rotation and a drop toward the edges.
function fanStyle(i: number, n: number): React.CSSProperties {
  const offset = i - (n - 1) / 2;
  return { '--fan': offset, '--lift': offset * offset } as React.CSSProperties;
}

export function Hand({ cards, legalCards, canPlay, highlightSuit = null, onPlay }: HandProps) {
  const legalIds = new Set(legalCards.map(cardId));
  return (
    <div className="hand hand-fan" role="group" aria-label={canPlay ? 'Your hand - choose a card to play' : 'Your hand'}>
      {cards.map((card, i) => {
        const isLegal = legalIds.has(cardId(card));
        const disabled = !canPlay || !isLegal;
        const highlight = !disabled && highlightSuit !== null && card.suit === highlightSuit;
        return (
          <span key={cardId(card)} className={`hand-slot ${highlight ? 'hand-slot-trump' : ''}`} style={fanStyle(i, cards.length)}>
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
