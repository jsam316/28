import {
  type Card,
  type CompletedTrick,
  type PlayedCard,
  type Suit,
  cardPoints,
  cardStrength,
} from './types.js';

export function legalCardsFor(hand: Card[], ledSuit: Suit | null): Card[] {
  if (ledSuit === null) return hand.slice();
  const followers = hand.filter((c) => c.suit === ledSuit);
  return followers.length > 0 ? followers : hand.slice();
}

// Once the second round of bidding opens (everyone has all 8 cards), a new
// bid must be at least this high, even if the standing bid from round 1 was
// lower - round 2 is for confident, full-hand bids only.
export const SECOND_ROUND_MIN_BID = 24;

export function minNextBid(currentBid: number | null, minBid: number, secondBatchDealt: boolean): number {
  if (currentBid === null) return minBid;
  const next = currentBid + 1;
  return secondBatchDealt ? Math.max(next, SECOND_ROUND_MIN_BID) : next;
}

// A bid's tier sets the automatic base stake in base cards, before any table
// double/redouble: 20-23 doubles it, 24+ quadruples it.
export function bidTierStake(bid: number): 1 | 2 | 4 {
  if (bid >= 24) return 4;
  if (bid >= 20) return 2;
  return 1;
}

export function resolveTrick(cards: PlayedCard[], trumpSuit: Suit | null, trickNumber: number): CompletedTrick {
  const ledSuit = cards[0].card.suit;
  const trumpPlays = trumpSuit ? cards.filter((pc) => pc.card.suit === trumpSuit) : [];
  const contenders = trumpPlays.length > 0 ? trumpPlays : cards.filter((pc) => pc.card.suit === ledSuit);

  let winner = contenders[0];
  for (const pc of contenders) {
    if (cardStrength(pc.card) > cardStrength(winner.card)) winner = pc;
  }

  const points = cards.reduce((sum, pc) => sum + cardPoints(pc.card), 0);

  return {
    trickNumber,
    cards,
    winnerSeat: winner.seat,
    points,
  };
}
