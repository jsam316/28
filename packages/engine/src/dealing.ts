import { buildDeck, shuffle } from './deck.js';
import { playerName } from './state.js';
import {
  type BiddingState,
  type Card,
  type GameState,
  type KunukkuLevel,
  type Player,
  type RoundResult,
  type Seat,
  cardPoints,
  nextSeat,
} from './types.js';

export interface GameOptions {
  baseCardsPerTeam?: number;
  minBid?: number;
  maxBid?: number;
  rng?: () => number;
}

const DEFAULTS = { baseCardsPerTeam: 6, minBid: 14, maxBid: 28 };

function dealRound(
  players: Player[],
  dealerSeat: Seat,
  baseCards: [number, number],
  totalBaseCards: number,
  roundNumber: number,
  opts: Required<GameOptions>,
  history: RoundResult[],
  kunukku: [KunukkuLevel, KunukkuLevel, KunukkuLevel, KunukkuLevel]
): GameState {
  const deck = shuffle(buildDeck(), opts.rng);
  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  const stock: [Card[], Card[], Card[], Card[]] = [[], [], [], []];

  const order: Seat[] = [];
  let s = nextSeat(dealerSeat);
  for (let i = 0; i < 4; i++) {
    order.push(s);
    s = nextSeat(s);
  }

  // Deal first batch of 4, one card at a time, round-robin.
  for (let round = 0; round < 4; round++) {
    for (const seat of order) {
      hands[seat].push(deck.pop() as Card);
    }
  }
  // Remaining 16 cards held back as the second batch (4 each).
  for (let round = 0; round < 4; round++) {
    for (const seat of order) {
      stock[seat].push(deck.pop() as Card);
    }
  }

  const openingBidder = nextSeat(dealerSeat);

  const bidding: BiddingState = {
    turnSeat: openingBidder,
    minBid: opts.minBid,
    maxBid: opts.maxBid,
    currentBid: null,
    currentBidderSeat: null,
    passed: [false, false, false, false],
    history: [],
  };

  return {
    players,
    dealerSeat,
    phase: 'bidding',
    hands,
    stock,
    firstBatchSize: 4,
    secondBatchDealt: false,
    bidding,
    trump: { suit: null, card: null, chosenBySeat: null, revealed: false },
    trick: { leadSeat: null, cards: [], trickNumber: 1 },
    completedTricks: [],
    baseCards,
    totalBaseCards,
    mustTrumpSeat: null,
    roundNumber,
    history,
    log: [`Round ${roundNumber}: cards dealt. ${playerName(players, openingBidder)} opens the bidding.`],
    winner: null,
    kunukku,
  };
}

export function createGame(players: Player[], options: GameOptions = {}): GameState {
  const opts: Required<GameOptions> = {
    baseCardsPerTeam: options.baseCardsPerTeam ?? DEFAULTS.baseCardsPerTeam,
    minBid: options.minBid ?? DEFAULTS.minBid,
    maxBid: options.maxBid ?? DEFAULTS.maxBid,
    rng: options.rng ?? Math.random,
  };
  return dealRound(
    players,
    0,
    [opts.baseCardsPerTeam, opts.baseCardsPerTeam],
    opts.baseCardsPerTeam * 2,
    1,
    opts,
    [],
    [0, 0, 0, 0]
  );
}

function carriedOptions(state: GameState, options: GameOptions): Required<GameOptions> {
  return {
    baseCardsPerTeam: state.totalBaseCards / 2,
    minBid: state.bidding.minBid,
    maxBid: state.bidding.maxBid,
    rng: options.rng ?? Math.random,
  };
}

export function startNextRound(state: GameState, options: GameOptions = {}): GameState {
  return dealRound(
    state.players,
    nextSeat(state.dealerSeat),
    state.baseCards,
    state.totalBaseCards,
    state.roundNumber + 1,
    carriedOptions(state, options),
    state.history,
    state.kunukku
  );
}

// The player who opens the bidding may throw the hand in if their first four
// cards are completely pointless (only K, Q, 8, 7). It is their choice, and
// only theirs - the other three have no say however poor their cards are.
export function canDemandRedeal(state: GameState, seat: Seat): boolean {
  if (state.phase !== 'bidding') return false;
  if (state.secondBatchDealt) return false;
  if (state.bidding.history.length > 0) return false; // only before any bid or pass
  if (state.bidding.turnSeat !== seat) return false;
  return state.hands[seat].every((c) => cardPoints(c) === 0);
}

// Same dealer deals the same round again; the match state carries over.
export function redealRound(state: GameState, reason: string, options: GameOptions = {}): GameState {
  const fresh = dealRound(
    state.players,
    state.dealerSeat,
    state.baseCards,
    state.totalBaseCards,
    state.roundNumber,
    carriedOptions(state, options),
    state.history,
    state.kunukku
  );
  return { ...fresh, log: [...state.log, reason, ...fresh.log] };
}

export function demandRedeal(state: GameState, seat: Seat, options: GameOptions = {}): GameState {
  if (!canDemandRedeal(state, seat)) {
    throw new Error('You cannot demand a redeal right now');
  }
  return redealRound(
    state,
    `${playerName(state.players, seat)} has no point cards and demands a redeal.`,
    options
  );
}

// Move the held-back second batch into every hand.
export function dealSecondBatch(state: GameState): { hands: GameState['hands']; stock: GameState['stock'] } {
  const hands = structuredClone(state.hands) as GameState['hands'];
  const stock = structuredClone(state.stock) as GameState['stock'];
  for (let s = 0; s < 4; s++) {
    hands[s as Seat].push(...stock[s as Seat]);
    stock[s as Seat] = [];
  }
  return { hands, stock };
}
