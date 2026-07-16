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

export interface BidStakes {
  win: number;
  failPenalty: number;
}

// Higher bids carry more risk and more reward, matching how the game is
// scored in practice rather than a flat one point either way.
export function bidStakes(bid: number): BidStakes {
  if (bid >= 25) return { win: 3, failPenalty: 4 };
  if (bid >= 20) return { win: 2, failPenalty: 3 };
  return { win: 1, failPenalty: 1 };
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
