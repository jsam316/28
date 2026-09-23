// The heuristic playing policy shared by every bot difficulty and by the
// expert's Monte Carlo playouts. Pure functions of a PlayerView: no state
// is kept between decisions.
import { type TableMemory, buildMemory, isBoss, isKnownVoid, seatsAfter, unseenInSuit } from './tracking.js';
import { type Card, type PlayerView, type Seat, type Suit, cardPoints, cardStrength, teamOf } from './types.js';

export type BotDifficulty = 'rookie' | 'regular' | 'expert';
export interface DifficultyProfile {
  caution: number; // points knocked off the expected haul before bidding (negative = overbids)
  jitterScale: number; // multiplier on the base +/-1.5 hand-jitter range
  mistakeChance: number; // odds of ignoring the "smart" choice entirely
  feedsPartner: boolean; // throws point cards onto a partner's safe kai
  tracking: boolean; // remembers played cards and voids to judge boss cards and risks
  // Monte Carlo playouts over the unseen cards for the endgame (expert only).
  simulation?: { samples: number; maxHand: number };
}

export const DIFFICULTY_PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  rookie: { caution: -1, jitterScale: 2.6, mistakeChance: 0.22, feedsPartner: false, tracking: false },
  regular: { caution: 0, jitterScale: 1, mistakeChance: 0, feedsPartner: true, tracking: false },
  expert: {
    caution: 0.5,
    jitterScale: 0.35,
    mistakeChance: 0,
    feedsPartner: true,
    tracking: true,
    simulation: { samples: 16, maxHand: 8 },
  },
};

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

// --- Hand evaluation -------------------------------------------------------
// A hand is scored for a candidate trump suit: trumps are worth 3 each plus a
// bonus for the high ones, off-suit Jacks, 9s and Aces win kai on their own,
// a void is a ruffing chance, and point cards in hand are points the other
// side cannot take. The score was calibrated by simulation (see the bench and
// the comments in willingBid) against the points a declaring team actually
// captured, so a bid can be read straight off it.
const TRUMP_HIGH: Partial<Record<Card['rank'], number>> = { J: 5, '9': 3, A: 2, '10': 1 };
const OFF_SUIT_HIGH: Partial<Record<Card['rank'], number>> = { J: 4, '9': 2, A: 1 };

export function handValue(hand: Card[], trump: Suit): number {
  let score = 0;
  for (const c of hand) {
    if (c.suit === trump) score += 3 + (TRUMP_HIGH[c.rank] ?? 0);
    else score += OFF_SUIT_HIGH[c.rank] ?? 0;
    score += 0.5 * cardPoints(c);
  }
  for (const s of SUITS) {
    if (s !== trump && !hand.some((c) => c.suit === s)) score += 1.5;
  }
  return score;
}

export function bestTrumpSuit(hand: Card[]): { suit: Suit; score: number } {
  let best = { suit: SUITS[0], score: -1 };
  for (const suit of SUITS) {
    const score = handValue(hand, suit);
    if (score > best.score) best = { suit, score };
  }
  return best;
}

// The points a declaring team can expect from a hand of this value. Fitted
// over ~20,000 simulated deals played out by the bots: with the full hand,
// mean points ≈ 3.3 + 0.51 × score; on the first four cards alone (the rest
// still unknown) mean points ≈ 9.1 + 0.37 × score. A hand with all four
// suits and no honours scores around 12, i.e. a fair share of 14 points.
export function expectedPoints(hand: Card[]): number {
  const { score } = bestTrumpSuit(hand);
  return hand.length >= 8 ? 3.3 + 0.51 * score : 9.1 + 0.37 * score;
}

export const byStrengthAsc = (a: Card, b: Card) => cardStrength(a) - cardStrength(b);
export const byStrengthDesc = (a: Card, b: Card) => cardStrength(b) - cardStrength(a);
// Cheapest first: fewest points, then weakest.
export const byCostAsc = (a: Card, b: Card) => cardPoints(a) - cardPoints(b) || cardStrength(a) - cardStrength(b);
// Juiciest first: most points, then strongest.
export const byValueDesc = (a: Card, b: Card) => cardPoints(b) - cardPoints(a) || cardStrength(b) - cardStrength(a);


export function currentBestPlay(
  cards: { seat: number; card: Card; playedAfterReveal?: boolean }[],
  ledSuit: Suit,
  activeTrumpSuit: Suit | null
): { seat: number; card: Card } {
  // Only cards played after the exposure count as trumps - a trump-suit card
  // that hit the table before the call is just a discard.
  const trumpPlays = activeTrumpSuit
    ? cards.filter((pc) => pc.card.suit === activeTrumpSuit && pc.playedAfterReveal)
    : [];
  const contenders = trumpPlays.length > 0 ? trumpPlays : cards.filter((pc) => pc.card.suit === ledSuit);
  let winner = contenders[0];
  for (const pc of contenders) {
    if (cardStrength(pc.card) > cardStrength(winner.card)) winner = pc;
  }
  return winner;
}

// Everything a play decision needs to know about the kai in progress.
interface TrickContext {
  view: PlayerView;
  profile: DifficultyProfile;
  memory: TableMemory | null;
  legal: Card[];
  knownTrump: Suit | null; // what this bot knows the trump to be (bidder sees it concealed)
  activeTrump: Suit | null; // the trump that can actually win right now (revealed only)
  ledSuit: Suit;
  best: { seat: number; card: Card };
  partnerWinning: boolean;
  isLast: boolean;
  opponentsAfter: Seat[];
  trickPoints: number;
}

function trickContext(view: PlayerView, profile: DifficultyProfile, memory: TableMemory | null): TrickContext {
  const trickCards = view.trick.cards;
  const ledSuit = trickCards[0].card.suit;
  const activeTrump = view.trump.revealed ? view.trump.suit : null;
  const best = currentBestPlay(trickCards, ledSuit, activeTrump);
  const myTeam = teamOf(view.you);
  const after = seatsAfter(view);
  return {
    view,
    profile,
    memory,
    legal: view.legalCards,
    knownTrump: view.trump.suit,
    activeTrump,
    ledSuit,
    best,
    partnerWinning: teamOf(best.seat as Seat) === myTeam,
    isLast: after.length === 0,
    opponentsAfter: after.filter((s) => teamOf(s) !== myTeam),
    trickPoints: trickCards.reduce((sum, pc) => sum + cardPoints(pc.card), 0),
  };
}

// Could an opponent still to play beat the card currently winning for our
// side? Without memory the bot only trusts a Jack (the top of any suit).
function partnerIsSafe(ctx: TrickContext): boolean {
  if (ctx.isLast) return true;
  const { best, memory, activeTrump, ledSuit, opponentsAfter } = ctx;
  const bestIsTrump = activeTrump !== null && best.card.suit === activeTrump;
  if (!memory) return best.card.rank === 'J' && (bestIsTrump || activeTrump === null);
  if (!isBoss(best.card, memory)) return false;
  if (bestIsTrump) return true;
  // A boss card in a plain suit can still be ruffed by an opponent who is void.
  return !opponentsAfter.some(
    (s) =>
      isKnownVoid(memory, s, ledSuit) &&
      (activeTrump !== null ? unseenInSuit(memory, activeTrump).length > 0 : true)
  );
}

// An opponent yet to play who is void in the led suit and could ruff.
function ruffThreat(ctx: TrickContext): boolean {
  const { memory, activeTrump, ledSuit, opponentsAfter } = ctx;
  if (!memory || !activeTrump) return false;
  const trumpsOut = unseenInSuit(memory, activeTrump).length > 0;
  return trumpsOut && opponentsAfter.some((s) => isKnownVoid(memory, s, ledSuit));
}

function chooseLead(view: PlayerView, profile: DifficultyProfile, memory: TableMemory | null): Card {
  const legal = view.legalCards;
  const knownTrump = view.trump.suit;
  const activeTrump = view.trump.revealed ? view.trump.suit : null;
  const myTeam = teamOf(view.you);
  const opponents = ([0, 1, 2, 3] as Seat[]).filter((s) => teamOf(s) !== myTeam);

  if (memory) {
    // Draw trumps when we are the declaring side, hold the boss trump and the
    // opponents may still have some: every trump pulled is a ruff prevented.
    if (activeTrump && view.trump.chosenBySeat !== null && teamOf(view.trump.chosenBySeat) === myTeam) {
      const trumps = legal.filter((c) => c.suit === activeTrump).sort(byStrengthDesc);
      if (trumps.length >= 2 && isBoss(trumps[0], memory) && unseenInSuit(memory, activeTrump).length > 0) {
        return trumps[0];
      }
    }
    // Cash a boss card in a suit no opponent is known to be void in - the
    // juiciest first, since it will collect its own points.
    const safeBosses = legal
      .filter((c) => c.suit !== activeTrump && isBoss(c, memory))
      .filter((c) => !opponents.some((s) => isKnownVoid(memory, s, c.suit)))
      .sort(byValueDesc);
    if (safeBosses.length > 0) return safeBosses[0];
  }

  // Otherwise lead from the longest non-trump suit: its top card if that is a
  // likely winner, else its cheapest card to give as little away as possible.
  const nonTrumpSuits = SUITS.filter((s) => s !== knownTrump);
  let choice: { suit: Suit; count: number } = { suit: legal[0].suit, count: -1 };
  for (const s of nonTrumpSuits) {
    const count = legal.filter((c) => c.suit === s).length;
    if (count > choice.count) choice = { suit: s, count };
  }
  if (choice.count <= 0) choice = { suit: legal[0].suit, count: legal.length };
  const candidates = legal.filter((c) => c.suit === choice.suit);
  const hasHighCard = candidates.some((c) => c.rank === 'J' || c.rank === '9' || c.rank === 'A');
  if (hasHighCard) return [...candidates].sort(byStrengthDesc)[0];
  return profile.feedsPartner ? [...candidates].sort(byCostAsc)[0] : [...candidates].sort(byStrengthAsc)[0];
}

function chooseFollow(ctx: TrickContext): Card {
  const { legal, ledSuit, best, profile, memory, isLast } = ctx;
  const followers = legal.filter((c) => c.suit === ledSuit);

  if (ctx.partnerWinning) {
    // Partner has it: feed the kai with points if it is safe, else keep cheap.
    if (profile.feedsPartner && partnerIsSafe(ctx)) return [...followers].sort(byValueDesc)[0];
    return [...followers].sort(byCostAsc)[0];
  }

  const winners = followers.filter((c) => cardStrength(c) > cardStrength(best.card)).sort(byStrengthAsc);
  if (winners.length === 0) return [...followers].sort(byCostAsc)[0];

  // Don't spend a winner on a kai that is going to be ruffed anyway.
  if (ruffThreat(ctx) && ctx.trickPoints <= 1) return [...followers].sort(byCostAsc)[0];

  if (memory && !isLast) {
    // If the cheapest winner can still be overtaken, secure the kai with the
    // boss card when we hold it and the points justify it.
    const cheapest = winners[0];
    const canBeBeaten =
      !isBoss(cheapest, memory) && ctx.opponentsAfter.some((s) => !isKnownVoid(memory, s, ledSuit));
    if (canBeBeaten) {
      const boss = winners.find((c) => isBoss(c, memory));
      if (boss && ctx.trickPoints + cardPoints(boss) >= 2) return boss;
    }
  }
  return winners[0];
}

function chooseDiscard(ctx: TrickContext): Card {
  const { legal, activeTrump, best, profile, memory } = ctx;
  const nonTrump = activeTrump ? legal.filter((c) => c.suit !== activeTrump) : legal;
  const pool = nonTrump.length > 0 ? nonTrump : legal;

  if (ctx.partnerWinning) {
    if (profile.feedsPartner && partnerIsSafe(ctx)) return [...pool].sort(byValueDesc)[0];
    return [...pool].sort(byCostAsc)[0];
  }

  // Ruffing only works once the trump has been revealed.
  if (activeTrump) {
    const trumps = legal.filter((c) => c.suit === activeTrump);
    const currentTrumpStrength = best.card.suit === activeTrump ? cardStrength(best.card) : -1;
    const winningTrumps = trumps.filter((c) => cardStrength(c) > currentTrumpStrength).sort(byStrengthAsc);
    if (winningTrumps.length > 0) {
      // A trump is worth more than a pointless kai unless we are flush with them.
      const worthIt = ctx.trickPoints > 0 || trumps.length >= 3 || ctx.legal.length <= 2 || !profile.tracking;
      if (worthIt) {
        if (memory && !ctx.isLast) {
          // Could a later opponent overruff? Then use the boss trump if held.
          const overruff = ctx.opponentsAfter.some(
            (s) =>
              isKnownVoid(memory, s, ctx.ledSuit) &&
              unseenInSuit(memory, activeTrump).some((c) => cardStrength(c) > cardStrength(winningTrumps[0]))
          );
          if (overruff) {
            const boss = winningTrumps.find((c) => isBoss(c, memory));
            if (boss) return boss;
          }
        }
        return winningTrumps[0];
      }
    }
  }

  return [...pool].sort(byCostAsc)[0];
}

export function smartPlay(view: PlayerView, profile: DifficultyProfile): Card {
  const legal = view.legalCards;
  if (legal.length === 1) return legal[0];

  const memory = profile.tracking ? buildMemory(view) : null;
  if (view.trick.cards.length === 0) return chooseLead(view, profile, memory);

  const ctx = trickContext(view, profile, memory);
  const canFollowSuit = legal.some((c) => c.suit === ctx.ledSuit);
  return canFollowSuit ? chooseFollow(ctx) : chooseDiscard(ctx);
}

export function partnerTakingTrick(view: PlayerView): boolean {
  const trickCards = view.trick.cards;
  if (trickCards.length === 0) return false;
  const activeTrump = view.trump.revealed ? view.trump.suit : null;
  const ledSuit = trickCards[0].card.suit;
  const best = currentBestPlay(trickCards, ledSuit, activeTrump);
  return teamOf(best.seat as Seat) === teamOf(view.you);
}

// Reached only when the bot is void in the led suit and the trump is still
// concealed. Decide whether to call for it (revealing it to everyone).
export function wantsTrumpReveal(view: PlayerView, profile: DifficultyProfile): boolean {
  // No point revealing if our side already looks to be taking the kai.
  if (partnerTakingTrick(view)) return false;
  const trickPoints = view.trick.cards.reduce((sum, pc) => sum + cardPoints(pc.card), 0);
  // The bidder can see the concealed trump, so only reveal with a trump to
  // ruff with; anyone else is gambling that they hold one.
  if (view.trump.suit !== null) {
    const trumps = view.hand.filter((c) => c.suit === view.trump.suit);
    if (trumps.length === 0) return false;
    // A careful bidder keeps the trump hidden for a kai that is worth taking.
    return !profile.tracking || trickPoints > 0 || trumps.length >= 3;
  }
  // Gambling on an unknown trump: worth it for a kai with points, or late in
  // the hand when there is little left to lose.
  return !profile.tracking || trickPoints > 0 || view.hand.length <= 3;
}
