import type { Suit } from '@twenty-eight/engine';

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export const SUIT_NAME: Record<Suit, string> = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOL[suit];
}

export function suitName(suit: Suit): string {
  return SUIT_NAME[suit];
}
