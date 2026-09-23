// Determinized Monte Carlo play for the expert bot. The bot cannot see the
// other hands, but it knows every card that has been played, which seats have
// shown themselves void in a suit, and how many cards each seat holds. So it
// deals the unseen cards out to the other seats in many ways consistent with
// all of that, plays each candidate card out to the end of the round with the
// ordinary heuristics for everyone, and picks the card that wins the round
// (and the most points) most often.
import { resolveTrick } from './rules.js';
import { buildMemory } from './tracking.js';
import { DIFFICULTY_PROFILES, type DifficultyProfile, smartPlay, wantsTrumpReveal } from './policy.js';
import {
  type Card,
  type CompletedTrick,
  type PlayedCard,
  type PlayerView,
  type Seat,
  type Suit,
  TOTAL_POINTS,
  cardId,
  nextSeat,
  teamOf,
} from './types.js';

export interface SimulationSettings {
  samples: number; // deals of the unseen cards to try per decision
  maxHand: number; // only simulate once this many (or fewer) cards remain in hand
}

export type SimulatedAction = { type: 'reveal' } | { type: 'play'; card: Card };

// Mutable, throwaway copy of everything that matters for playing a round out.
interface SimState {
  hands: Card[][];
  trick: PlayedCard[];
  leadSeat: Seat;
  trickNumber: number;
  completed: CompletedTrick[];
  trumpSuit: Suit;
  trumpCard: Card | null;
  chosenBySeat: Seat;
  revealed: boolean;
  mustTrumpSeat: Seat | null;
  bidderTeam: 0 | 1;
  bid: number;
  points: [number, number];
  finished: boolean;
}

// Playouts use the plain "regular" policy for everyone, with no mistakes and
// no tracking - fast, deterministic, and good enough to judge a position.
const PLAYOUT_PROFILE: DifficultyProfile = { ...DIFFICULTY_PROFILES.regular, mistakeChance: 0 };

function playableHand(sim: SimState, seat: Seat): Card[] {
  if (sim.chosenBySeat === seat && !sim.revealed && sim.trumpCard) {
    const rest = sim.hands[seat].filter((c) => cardId(c) !== cardId(sim.trumpCard as Card));
    return rest.length > 0 ? rest : sim.hands[seat];
  }
  return sim.hands[seat];
}

function legalPlays(sim: SimState, seat: Seat): Card[] {
  const hand = playableHand(sim, seat);
  const led = sim.trick[0]?.card.suit ?? null;
  let legal = hand;
  if (led !== null) {
    const followers = hand.filter((c) => c.suit === led);
    if (followers.length > 0) legal = followers;
  }
  if (sim.mustTrumpSeat === seat && sim.revealed) {
    const trumps = legal.filter((c) => c.suit === sim.trumpSuit);
    if (trumps.length > 0) return trumps;
  }
  return legal;
}

function canCall(sim: SimState, seat: Seat): boolean {
  if (sim.revealed || sim.trick.length === 0) return false;
  const led = sim.trick[0].card.suit;
  return !playableHand(sim, seat).some((c) => c.suit === led);
}

// The slice of a PlayerView the heuristics actually read.
function viewFor(sim: SimState, seat: Seat, base: PlayerView): PlayerView {
  const seesTrump = sim.revealed || sim.chosenBySeat === seat;
  return {
    ...base,
    you: seat,
    hand: sim.hands[seat],
    legalCards: legalPlays(sim, seat),
    trick: { leadSeat: sim.leadSeat, cards: sim.trick, trickNumber: sim.trickNumber },
    completedTricks: sim.completed,
    trump: {
      suit: seesTrump ? sim.trumpSuit : null,
      card: seesTrump ? sim.trumpCard : null,
      concealedForYou: !seesTrump,
      chosenBySeat: sim.chosenBySeat,
      revealed: sim.revealed,
    },
    canRequestTrumpReveal: canCall(sim, seat),
  };
}

function applyReveal(sim: SimState, seat: Seat) {
  sim.revealed = true;
  sim.mustTrumpSeat = seat;
}

function applyPlay(sim: SimState, seat: Seat, card: Card) {
  if (!sim.revealed && sim.trumpCard && sim.chosenBySeat === seat && cardId(card) === cardId(sim.trumpCard)) {
    sim.revealed = true; // forced exposure of the last card
  }
  sim.hands[seat] = sim.hands[seat].filter((c) => cardId(c) !== cardId(card));
  sim.trick.push({ seat, card, playedAfterReveal: sim.revealed });
  if (sim.mustTrumpSeat === seat) sim.mustTrumpSeat = null;
  if (sim.trick.length < 4) return;

  const done = resolveTrick(sim.trick, sim.revealed ? sim.trumpSuit : null, sim.trickNumber);
  sim.completed.push(done);
  sim.points[teamOf(done.winnerSeat)] += done.points;
  sim.trick = [];
  sim.leadSeat = done.winnerSeat;
  sim.trickNumber++;
  const defenders = sim.bidderTeam === 0 ? 1 : 0;
  if (sim.completed.length === 8 || sim.points[defenders] > TOTAL_POINTS - sim.bid) sim.finished = true;
}

function seatToPlay(sim: SimState): Seat {
  return sim.trick.length === 0 ? sim.leadSeat : nextSeat(sim.trick[sim.trick.length - 1].seat);
}

function playOut(sim: SimState, base: PlayerView) {
  let guard = 0;
  while (!sim.finished && guard++ < 40) {
    const seat = seatToPlay(sim);
    const view = viewFor(sim, seat, base);
    if (view.canRequestTrumpReveal && wantsTrumpReveal(view, PLAYOUT_PROFILE)) {
      applyReveal(sim, seat);
      const after = viewFor(sim, seat, base);
      applyPlay(sim, seat, smartPlay(after, PLAYOUT_PROFILE));
      continue;
    }
    applyPlay(sim, seat, view.legalCards.length === 1 ? view.legalCards[0] : smartPlay(view, PLAYOUT_PROFILE));
  }
}

// How good the finished round is for the viewer's team: winning the round is
// what moves base cards; points beyond that break ties.
function scoreFor(sim: SimState, team: 0 | 1): number {
  const made = sim.points[sim.bidderTeam] >= sim.bid;
  const won = made ? sim.bidderTeam === team : sim.bidderTeam !== team;
  return (won ? 100 : 0) + sim.points[team];
}

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Deal the unseen cards to the other three seats, honouring hand sizes and
// the suits each seat has shown itself void in (when possible), plus the
// revealed trump card still held by its chooser.
function dealUnseen(view: PlayerView, rng: () => number): Card[][] | null {
  const memory = buildMemory(view);
  const others = ([0, 1, 2, 3] as Seat[]).filter((s) => s !== view.you);
  const need: Record<number, number> = {};
  for (const s of others) need[s] = view.handCounts[s];

  let pool = memory.unseen;
  const fixed: Card[][] = [[], [], [], []];
  // A revealed trump card that has not been played is still in its chooser's hand.
  if (view.trump.card && view.trump.chosenBySeat !== null && view.trump.chosenBySeat !== view.you) {
    const tc = view.trump.card;
    if (pool.some((c) => cardId(c) === cardId(tc))) {
      fixed[view.trump.chosenBySeat].push(tc);
      need[view.trump.chosenBySeat]--;
      pool = pool.filter((c) => cardId(c) !== cardId(tc));
    }
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const respectVoids = attempt < 8;
    const cards = pool.slice();
    shuffleInPlace(cards, rng);
    const dealt: Card[][] = fixed.map((h) => h.slice());
    const remaining = { ...need };
    let ok = true;
    for (const c of cards) {
      const options = others.filter(
        (s) => remaining[s] > 0 && (!respectVoids || !memory.voids[s].has(c.suit))
      );
      if (options.length === 0) {
        ok = false;
        break;
      }
      const seat = options[Math.floor(rng() * options.length)];
      dealt[seat].push(c);
      remaining[seat]--;
    }
    if (ok) return dealt;
  }
  return null;
}

function simFrom(view: PlayerView, dealt: Card[][]): SimState {
  const hands = dealt.map((h) => h.slice());
  hands[view.you] = view.hand.slice();
  const bidderSeat = view.bidding.currentBidderSeat as Seat;
  return {
    hands,
    trick: view.trick.cards.slice(),
    leadSeat: view.trick.leadSeat as Seat,
    trickNumber: view.trick.trickNumber,
    completed: view.completedTricks.slice(),
    trumpSuit: view.trump.suit as Suit,
    trumpCard: view.trump.card,
    chosenBySeat: view.trump.chosenBySeat as Seat,
    revealed: view.trump.revealed,
    mustTrumpSeat: null,
    bidderTeam: teamOf(bidderSeat),
    bid: view.bidding.currentBid as number,
    points: view.completedTricks.reduce<[number, number]>(
      (acc, t) => {
        acc[teamOf(t.winnerSeat)] += t.points;
        return acc;
      },
      [0, 0]
    ),
    finished: false,
  };
}

export function monteCarloPlay(
  view: PlayerView,
  settings: SimulationSettings,
  rng: () => number = Math.random
): SimulatedAction | null {
  if (view.hand.length > settings.maxHand) return null;
  if (view.bidding.currentBidderSeat === null || view.bidding.currentBid === null) return null;
  // The trump suit is needed to play a round out. A non-chooser does not know
  // it while it is concealed - guess it per sample from the chooser's cards.
  const knowsTrump = view.trump.suit !== null;

  const candidates: SimulatedAction[] = view.legalCards.map((card) => ({ type: 'play', card }));
  if (view.canRequestTrumpReveal) candidates.push({ type: 'reveal' });
  if (candidates.length < 2) return null;

  const totals = new Array<number>(candidates.length).fill(0);
  let samples = 0;
  for (let i = 0; i < settings.samples; i++) {
    const dealt = dealUnseen(view, rng);
    if (!dealt) break;
    // Guess a concealed trump: the chooser set aside a card of the trump suit,
    // so pick one of the cards this deal gave them.
    let guessedSuit: Suit | null = view.trump.suit;
    let guessedCard: Card | null = view.trump.card;
    if (!knowsTrump) {
      const chooser = view.trump.chosenBySeat as Seat;
      const theirs = dealt[chooser];
      if (theirs.length === 0) continue;
      guessedCard = theirs[Math.floor(rng() * theirs.length)];
      guessedSuit = guessedCard.suit;
    }
    samples++;
    for (let k = 0; k < candidates.length; k++) {
      const sim = simFrom(view, dealt);
      sim.trumpSuit = guessedSuit as Suit;
      sim.trumpCard = guessedCard;
      const action = candidates[k];
      if (action.type === 'reveal') {
        applyReveal(sim, view.you);
        applyPlay(sim, view.you, smartPlay(viewFor(sim, view.you, view), PLAYOUT_PROFILE));
      } else {
        applyPlay(sim, view.you, action.card);
      }
      playOut(sim, view);
      totals[k] += scoreFor(sim, teamOf(view.you));
    }
  }
  if (samples === 0) return null;

  let best = 0;
  for (let k = 1; k < candidates.length; k++) {
    if (totals[k] > totals[best]) best = k;
  }
  return candidates[best];
}

