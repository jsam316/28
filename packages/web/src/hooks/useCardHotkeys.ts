import { useEffect } from 'react';
import type { Card } from '@twenty-eight/engine';

interface HotkeyOptions {
  enabled: boolean;
  hand: Card[];
  legalCards: Card[];
  canCallTrump: boolean;
  onPlay: (card: Card) => void;
  onCallTrump: () => void;
}

// Number keys 1-8 play the matching card of the hand (left to right) when it
// is legal; T calls for the trump. Ignored while typing in a field.
export function useCardHotkeys({ enabled, hand, legalCards, canCallTrump, onPlay, onCallTrump }: HotkeyOptions) {
  useEffect(() => {
    if (!enabled) return;
    const legalIds = new Set(legalCards.map((c) => `${c.rank}${c.suit}`));
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 't' || e.key === 'T') {
        if (canCallTrump) {
          e.preventDefault();
          onCallTrump();
        }
        return;
      }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 8) return;
      const card = hand[n - 1];
      if (!card || !legalIds.has(`${card.rank}${card.suit}`)) return;
      e.preventDefault();
      onPlay(card);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, hand, legalCards, canCallTrump, onPlay, onCallTrump]);
}
