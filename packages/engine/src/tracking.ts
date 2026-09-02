// What a careful player remembers about the table: every card that has been
// played, which seats have shown themselves void in a suit, and therefore
// which cards are still out there in other hands. Rebuilt from a PlayerView
// on every decision, so the bot keeps no state between turns.
import { buildDeck } from './deck.js';
import {
  type Card,
  type PlayedCard,
  type PlayerView,
  type Seat,
  type Suit,
  cardId,
  cardStrength,
} from './types.js';

export interface TableMemory {
  played: Set<string>;
  voids: [Set<Suit>, Set<Suit>, Set<Suit>, Set<Suit>];
  // Cards neither played nor in the viewer's hand: everything the other three
  // seats could still be holding (including the bidder's concealed trump).
  unseen: Card[];
}

function noteVoids(voids: TableMemory['voids'], cards: PlayedCard[]) {
  if (cards.length === 0) return;
  const led = cards[0].card.suit;
  for (const pc of cards.slice(1)) {
    if (pc.card.suit !== led) voids[pc.seat].add(led);
  }
}

export function buildMemory(view: PlayerView): TableMemory {
  const played = new Set<string>();
  const voids: TableMemory['voids'] = [new Set(), new Set(), new Set(), new Set()];
  for (const t of view.completedTricks) {
    for (const pc of t.cards) played.add(cardId(pc.card));
    noteVoids(voids, t.cards);
  }
  for (const pc of view.trick.cards) played.add(cardId(pc.card));
  noteVoids(voids, view.trick.cards);

  const mine = new Set(view.hand.map(cardId));
  const unseen = buildDeck().filter((c) => !played.has(cardId(c)) && !mine.has(cardId(c)));
  return { played, voids, unseen };
}

// True when no card of the suit still out in other hands can beat this one.
export function isBoss(card: Card, memory: TableMemory): boolean {
  return !memory.unseen.some((c) => c.suit === card.suit && cardStrength(c) > cardStrength(card));
}

export function unseenInSuit(memory: TableMemory, suit: Suit): Card[] {
  return memory.unseen.filter((c) => c.suit === suit);
}

export function isKnownVoid(memory: TableMemory, seat: Seat, suit: Suit): boolean {
  return memory.voids[seat].has(suit);
}

// Seats still to play to the current trick after the viewer, in order.
export function seatsAfter(view: PlayerView): Seat[] {
  const after: Seat[] = [];
  const toPlay = 4 - view.trick.cards.length - 1;
  let s = view.you;
  for (let i = 0; i < toPlay; i++) {
    s = ((s + 1) % 4) as Seat;
    after.push(s);
  }
  return after;
}
