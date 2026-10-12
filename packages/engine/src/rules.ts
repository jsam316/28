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

// Everything the play rules need to know to list a seat's legal cards. Shared
// by the referee (play.ts) and the expert bot's playouts (simulate.ts).
export interface PlaySituation {
  // The cards the seat may play from: for the trump chooser, the set-aside
  // card is left out while it stays concealed (see playableHand).
  hand: Card[];
  trick: Pick<PlayedCard, 'card' | 'playedAfterReveal'>[];
  completedTricks: Pick<CompletedTrick, 'cards'>[];
  trumpSuit: Suit | null; // the real trump suit, exposed or not
  revealed: boolean;
  isTrumpChooser: boolean;
  mustTrump: boolean; // this seat just called for the trump
}

// Until the trump is exposed the bidder may not lead the trump suit, unless
// they hold nothing else or another player has already led it.
export function trumpLeadBarred(s: PlaySituation): boolean {
  return (
    s.isTrumpChooser &&
    !s.revealed &&
    s.trumpSuit !== null &&
    !s.completedTricks.some((t) => t.cards[0]?.card.suit === s.trumpSuit) &&
    s.hand.some((c) => c.suit !== s.trumpSuit)
  );
}

export function legalPlays(s: PlaySituation): Card[] {
  if (s.trick.length === 0) {
    return trumpLeadBarred(s) ? s.hand.filter((c) => c.suit !== s.trumpSuit) : s.hand.slice();
  }
  const ledSuit = s.trick[0].card.suit;
  let options = legalCardsFor(s.hand, ledSuit);
  // Having called for the trump, the caller must play a trump to this kai if
  // they hold one.
  if (s.mustTrump && s.revealed && s.trumpSuit) {
    const trumps = options.filter((c) => c.suit === s.trumpSuit);
    if (trumps.length > 0) options = trumps;
  }
  // Once the kai has been trumped, a player who cannot follow suit must either
  // overtrump or discard another suit - never play a lower trump (unless
  // lower trumps are all they hold).
  const topTrump = highestTrumpStrength(s);
  if (topTrump !== null && !options.some((c) => c.suit === ledSuit)) {
    const allowed = options.filter((c) => c.suit !== s.trumpSuit || cardStrength(c) > topTrump);
    if (allowed.length > 0) options = allowed;
  }
  return options;
}

// The strength of the highest card counting as a trump in the kai so far, or
// null if the trump is not exposed or nobody has trumped yet.
function highestTrumpStrength(s: PlaySituation): number | null {
  if (!s.revealed || s.trumpSuit === null || s.trick.length === 0) return null;
  const ledSuit = s.trick[0].card.suit;
  let top: number | null = null;
  for (const pc of s.trick) {
    if (countsAsTrump(pc, ledSuit, s.trumpSuit)) top = Math.max(top ?? -1, cardStrength(pc.card));
  }
  return top;
}

// Once the rest of the hand is dealt, the second round of bidding is reserved
// for confident full-hand bids of 24 and up.
export const SECOND_ROUND_MIN_BID = 24;

// A round in which the trump is still concealed after this many kai is void.
export const VOID_AFTER_KAI = 7;

// "If you wish to bid over your partner's bid, your left hand opponent having
// passed, you must bid at least 20."
export const PARTNER_OVERCALL_MIN_BID = 20;

export function minNextBid(
  currentBid: number | null,
  minBid: number,
  secondBatchDealt: boolean,
  raisingOverPartner = false
): number {
  if (currentBid === null) return secondBatchDealt ? SECOND_ROUND_MIN_BID : minBid;
  let next = currentBid + 1;
  if (raisingOverPartner) next = Math.max(next, PARTNER_OVERCALL_MIN_BID);
  return secondBatchDealt ? Math.max(next, SECOND_ROUND_MIN_BID) : next;
}

// A bid's tier sets the automatic base stake in base cards, before any table
// double/redouble: 20-23 doubles it, 24+ quadruples it.
export function bidTierStake(bid: number): 1 | 2 | 4 {
  if (bid >= 24) return 4;
  if (bid >= 20) return 2;
  return 1;
}

// Whether a card in the kai counts as a trump. A trump-suit card discarded
// before the exposure was just a discard and cannot win - e.g. an ace of
// trumps thrown before the call is beaten by a queen of trumps played after
// it. But when the trump suit itself was led, every card that followed suit
// is a trump, whenever it was played, so the highest of them wins.
export function countsAsTrump(pc: Pick<PlayedCard, 'card' | 'playedAfterReveal'>, ledSuit: Suit, trumpSuit: Suit | null): boolean {
  if (trumpSuit === null || pc.card.suit !== trumpSuit) return false;
  return ledSuit === trumpSuit || pc.playedAfterReveal === true;
}

// The play currently winning a kai (complete or not). `trumpSuit` is the
// trump only once it has been exposed; before that it has no power.
export function winningPlay<T extends Pick<PlayedCard, 'card' | 'playedAfterReveal'>>(
  cards: T[],
  trumpSuit: Suit | null
): T {
  const ledSuit = cards[0].card.suit;
  const trumpPlays = cards.filter((pc) => countsAsTrump(pc, ledSuit, trumpSuit));
  const contenders = trumpPlays.length > 0 ? trumpPlays : cards.filter((pc) => pc.card.suit === ledSuit);
  let winner = contenders[0];
  for (const pc of contenders) {
    if (cardStrength(pc.card) > cardStrength(winner.card)) winner = pc;
  }
  return winner;
}

export function resolveTrick(cards: PlayedCard[], trumpSuit: Suit | null, trickNumber: number): CompletedTrick {
  const winner = winningPlay(cards, trumpSuit);
  const points = cards.reduce((sum, pc) => sum + cardPoints(pc.card), 0);

  return {
    trickNumber,
    cards,
    winnerSeat: winner.seat,
    points,
  };
}
