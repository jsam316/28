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

// The first round of bidding (on the first 4 cards) runs 14-23. Once the rest
// of the hand is dealt, the second round is reserved for confident full-hand
// bids of 24 and up.
export const FIRST_ROUND_MAX_BID = 23;
export const SECOND_ROUND_MIN_BID = 24;

export function minNextBid(currentBid: number | null, minBid: number, secondBatchDealt: boolean): number {
  if (currentBid === null) return secondBatchDealt ? SECOND_ROUND_MIN_BID : minBid;
  const next = currentBid + 1;
  return secondBatchDealt ? Math.max(next, SECOND_ROUND_MIN_BID) : next;
}

// The highest bid allowed in the current round: 23 in round one, the game's
// max (28) once the second round opens.
export function maxBidFor(secondBatchDealt: boolean, maxBid: number): number {
  return secondBatchDealt ? maxBid : FIRST_ROUND_MAX_BID;
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
