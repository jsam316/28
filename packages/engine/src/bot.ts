import {
  type Card,
  type PlayerView,
  STRENGTH_ORDER,
  type Suit,
  cardPoints,
  cardStrength,
  teamOf,
} from './types.js';

export type BotAction =
  | { type: 'bid'; value: 'pass' | number }
  | { type: 'trump'; suit: Suit }
  | { type: 'reveal' }
  | { type: 'play'; card: Card };

function suitStrengthScore(cards: Card[], suit: Suit): number {
  const inSuit = cards.filter((c) => c.suit === suit);
  const points = inSuit.reduce((sum, c) => sum + cardPoints(c), 0);
  const hasJ = inSuit.some((c) => c.rank === 'J');
  const hasNine = inSuit.some((c) => c.rank === '9');
  return points * 3 + inSuit.length * 2 + (hasJ ? 4 : 0) + (hasNine ? 2 : 0);
}

function bestSuit(cards: Card[]): { suit: Suit; score: number } {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  let best = { suit: suits[0], score: -1 };
  for (const suit of suits) {
    const score = suitStrengthScore(cards, suit);
    if (score > best.score) best = { suit, score };
  }
  return best;
}

function stableJitter(cards: Card[]): number {
  // Deterministic per-hand "personality" wobble so the same hand doesn't
  // reassess its willingness differently on every bidding turn.
  const key = cards
    .map((c) => `${c.rank}${c.suit}`)
    .sort()
    .join('|');
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 300) / 100) - 1.5; // range [-1.5, 1.5)
}

function decideBid(view: PlayerView): BotAction {
  const { score } = bestSuit(view.hand);
  const jitter = stableJitter(view.hand);
  const maxWillingBid = Math.round(8 + score * 0.65 + jitter);
  const { currentBid, minBid, maxBid } = view.bidding;
  const nextBid = currentBid === null ? minBid : currentBid + 1;
  if (nextBid > maxBid || maxWillingBid < nextBid) {
    return { type: 'bid', value: 'pass' };
  }
  return { type: 'bid', value: nextBid };
}

function decideTrump(view: PlayerView): BotAction {
  const { suit } = bestSuit(view.hand);
  return { type: 'trump', suit };
}

function currentBestPlay(
  cards: { seat: number; card: Card }[],
  ledSuit: Suit,
  knownTrumpSuit: Suit | null
): { seat: number; card: Card } {
  const trumpPlays = knownTrumpSuit ? cards.filter((pc) => pc.card.suit === knownTrumpSuit) : [];
  const contenders = trumpPlays.length > 0 ? trumpPlays : cards.filter((pc) => pc.card.suit === ledSuit);
  let winner = contenders[0];
  for (const pc of contenders) {
    if (cardStrength(pc.card) > cardStrength(winner.card)) winner = pc;
  }
  return winner;
}

function decidePlay(view: PlayerView): BotAction {
  const legal = view.legalCards;
  if (legal.length === 1) return { type: 'play', card: legal[0] };

  const trumpSuit = view.trump.suit;
  const trickCards = view.trick.cards;

  if (trickCards.length === 0) {
    // Leading: prefer the strongest card of our longest non-trump suit to probe for a safe winner.
    const suits: Suit[] = ['S', 'H', 'D', 'C'];
    const nonTrumpSuits = suits.filter((s) => s !== trumpSuit);
    let bestSuitChoice: { suit: Suit; count: number } = { suit: legal[0].suit, count: -1 };
    for (const s of nonTrumpSuits) {
      const count = legal.filter((c) => c.suit === s).length;
      if (count > bestSuitChoice.count) bestSuitChoice = { suit: s, count };
    }
    if (bestSuitChoice.count <= 0) {
      bestSuitChoice = { suit: legal[0].suit, count: legal.length };
    }
    const candidates = legal.filter((c) => c.suit === bestSuitChoice.suit);
    const hasHighCard = candidates.some((c) => c.rank === 'J' || c.rank === '9' || c.rank === 'A');
    candidates.sort((a, b) => cardStrength(b) - cardStrength(a));
    const lowestFirst = [...candidates].sort((a, b) => cardStrength(a) - cardStrength(b));
    return { type: 'play', card: hasHighCard ? candidates[0] : lowestFirst[0] };
  }

  const ledSuit = trickCards[0].card.suit;
  const you = view.you;
  const myTeam = teamOf(you as 0 | 1 | 2 | 3);
  const best = currentBestPlay(trickCards, ledSuit, trumpSuit);
  const partnerOrSelfWinning = teamOf(best.seat as 0 | 1 | 2 | 3) === myTeam;

  const canFollowSuit = legal.some((c) => c.suit === ledSuit);

  if (canFollowSuit) {
    const followers = legal.filter((c) => c.suit === ledSuit);
    if (partnerOrSelfWinning) {
      const lowest = [...followers].sort((a, b) => cardStrength(a) - cardStrength(b))[0];
      return { type: 'play', card: lowest };
    }
    const winners = followers
      .filter((c) => cardStrength(c) > cardStrength(best.card))
      .sort((a, b) => cardStrength(a) - cardStrength(b));
    if (winners.length > 0) return { type: 'play', card: winners[0] };
    const lowest = [...followers].sort((a, b) => cardStrength(a) - cardStrength(b))[0];
    return { type: 'play', card: lowest };
  }

  // Void in led suit.
  if (partnerOrSelfWinning) {
    const lowest = [...legal].sort((a, b) => cardPoints(a) - cardPoints(b) || cardStrength(a) - cardStrength(b))[0];
    return { type: 'play', card: lowest };
  }

  if (trumpSuit) {
    const trumps = legal.filter((c) => c.suit === trumpSuit);
    if (trumps.length > 0) {
      const currentTrumpStrength = best.card.suit === trumpSuit ? cardStrength(best.card) : -1;
      const winningTrumps = trumps
        .filter((c) => cardStrength(c) > currentTrumpStrength)
        .sort((a, b) => cardStrength(a) - cardStrength(b));
      if (winningTrumps.length > 0) return { type: 'play', card: winningTrumps[0] };
    }
  }

  const lowest = [...legal].sort((a, b) => cardPoints(a) - cardPoints(b) || cardStrength(a) - cardStrength(b))[0];
  return { type: 'play', card: lowest };
}

export function decideBotAction(view: PlayerView): BotAction {
  if (view.phase === 'bidding') return decideBid(view);
  if (view.phase === 'trump_selection') return decideTrump(view);
  if (view.phase === 'playing') {
    if (view.trump.suit === null && view.canRequestTrumpReveal) {
      return { type: 'reveal' };
    }
    return decidePlay(view);
  }
  throw new Error(`No bot action for phase ${view.phase}`);
}

export { STRENGTH_ORDER };
