import { isRaisingOverPartner } from './bidding.js';
import { minNextBid } from './rules.js';
import {
  type BotDifficulty,
  DIFFICULTY_PROFILES,
  type DifficultyProfile,
  SUITS,
  bestTrumpSuit,
  byStrengthAsc,
  expectedPoints,
  smartPlay,
  wantsTrumpReveal,
} from './policy.js';
import { monteCarloPlay } from './simulate.js';
import { type Card, type PlayerView, STRENGTH_ORDER, type Suit } from './types.js';

export type { BotDifficulty, DifficultyProfile } from './policy.js';
export { bestTrumpSuit, expectedPoints, handValue } from './policy.js';

export type BotAction =
  | { type: 'bid'; value: 'pass' | number }
  | { type: 'redeal' }
  | { type: 'trump'; card: Card }
  | { type: 'reveal' }
  | { type: 'play'; card: Card };

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

// The most this bot is prepared to bid on its hand right now.
function willingBid(view: PlayerView, profile: DifficultyProfile): number {
  const jitter = stableJitter(view.hand) * profile.jitterScale;
  // A player carrying a kunukku pushes a little harder to win the bid and
  // clear it, rather than folding into a passive hand as usual.
  const redemptionBonus = view.kunukku[view.you] > 0 ? 1 : 0;
  return Math.round(expectedPoints(view.hand) - profile.caution + jitter + redemptionBonus);
}

function decideBid(view: PlayerView, difficulty: BotDifficulty): BotAction {
  const profile = DIFFICULTY_PROFILES[difficulty];
  const maxWillingBid = willingBid(view, profile);
  const { currentBid, minBid, maxBid } = view.bidding;

  // The opener cannot pass: with no bid on the table in round one, open at the
  // minimum however poor the hand (a pointless hand takes the redeal path
  // before this is ever reached).
  if (!view.secondBatchDealt && view.bidding.history.length === 0) {
    return { type: 'bid', value: minBid };
  }

  // Raising over your own partner's standing bid requires at least 20.
  const nextBid = minNextBid(currentBid, minBid, view.secondBatchDealt, isRaisingOverPartner(view.bidding, view.you));
  if (nextBid > maxBid || maxWillingBid < nextBid) {
    return { type: 'bid', value: 'pass' };
  }
  return { type: 'bid', value: nextBid };
}

// Set aside the LOWEST card of the chosen trump suit, keeping the high trumps
// in hand to ruff and win kai with once the trump is revealed.
function lowestOfSuit(hand: Card[], suit: Suit): Card {
  return hand.filter((c) => c.suit === suit).sort(byStrengthAsc)[0];
}

function decideTrump(view: PlayerView, difficulty: BotDifficulty): BotAction {
  const profile = DIFFICULTY_PROFILES[difficulty];
  if (profile.mistakeChance > 0 && Math.random() < profile.mistakeChance) {
    const candidates = SUITS.filter((s) => view.hand.some((c) => c.suit === s));
    const suit = candidates[Math.floor(Math.random() * candidates.length)];
    return { type: 'trump', card: lowestOfSuit(view.hand, suit) };
  }
  const { suit } = bestTrumpSuit(view.hand);
  return { type: 'trump', card: lowestOfSuit(view.hand, suit) };
}

function decidePlay(view: PlayerView, profile: DifficultyProfile): BotAction {
  const legal = view.legalCards;
  if (legal.length > 1 && profile.mistakeChance > 0 && Math.random() < profile.mistakeChance) {
    return { type: 'play', card: legal[Math.floor(Math.random() * legal.length)] };
  }
  if (profile.simulation && legal.length > 1) {
    const mc = monteCarloPlay(view, profile.simulation);
    if (mc) return mc;
  }
  if (view.canRequestTrumpReveal && wantsTrumpReveal(view, profile)) {
    return { type: 'reveal' };
  }
  return { type: 'play', card: smartPlay(view, profile) };
}

export function decideBotAction(view: PlayerView, difficulty: BotDifficulty = 'regular'): BotAction {
  const profile = DIFFICULTY_PROFILES[difficulty];
  if (view.phase === 'bidding') {
    // A completely pointless opening hand is never worth bidding on - throw it in.
    if (view.canDemandRedeal) return { type: 'redeal' };
    return decideBid(view, difficulty);
  }
  if (view.phase === 'trump_selection') return decideTrump(view, difficulty);
  if (view.phase === 'playing') return decidePlay(view, profile);
  throw new Error(`No bot action for phase ${view.phase}`);
}

export { STRENGTH_ORDER };
