import {
  type Card,
  type CompletedTrick,
  type GameState,
  type Player,
  type Rank,
  type Seat,
  type Suit,
  cardPoints,
  createGame,
  nextSeat,
} from '../src/index.js';

// Small deterministic PRNG so a test can replay the exact same deal.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePlayers(): Player[] {
  return ([0, 1, 2, 3] as Seat[]).map((seat) => ({
    id: `p${seat}`,
    name: `P${seat}`,
    seat,
    isBot: true,
    connected: true,
  }));
}

// 'JS' -> { rank: 'J', suit: 'S' }, '10H' -> { rank: '10', suit: 'H' }
export function card(id: string): Card {
  const suit = id.slice(-1) as Suit;
  const rank = id.slice(0, -1) as Rank;
  return { rank, suit };
}

export function cards(...ids: string[]): Card[] {
  return ids.map(card);
}

export function id(c: Card): string {
  return `${c.rank}${c.suit}`;
}

export function ids(list: Card[]): string[] {
  return list.map(id);
}

export function seededGame(seed: number, baseCardsPerTeam = 6): GameState {
  return createGame(makePlayers(), { baseCardsPerTeam, rng: mulberry32(seed) });
}

interface PlayingStateOptions {
  hands: [string[], string[], string[], string[]];
  bidderSeat: Seat;
  bid: number;
  trumpCard: string;
  dealerSeat?: Seat;
  revealed?: boolean;
  baseCards?: [number, number];
  kunukku?: GameState['kunukku'];
}

// Build a state that is already in play with exactly the hands we want, so a
// test can exercise one rule without driving the whole auction first.
export function playingState(opts: PlayingStateOptions): GameState {
  const dealerSeat = opts.dealerSeat ?? 3;
  const trump = card(opts.trumpCard);
  const base = seededGame(1);
  return {
    ...base,
    dealerSeat,
    phase: 'playing',
    hands: opts.hands.map((h) => cards(...h)) as GameState['hands'],
    stock: [[], [], [], []],
    secondBatchDealt: true,
    bidding: {
      ...base.bidding,
      turnSeat: opts.bidderSeat,
      currentBid: opts.bid,
      currentBidderSeat: opts.bidderSeat,
      passed: [true, true, true, true],
      history: [{ seat: opts.bidderSeat, action: opts.bid }],
    },
    trump: { suit: trump.suit, card: trump, chosenBySeat: opts.bidderSeat, revealed: opts.revealed ?? false },
    trick: { leadSeat: nextSeat(dealerSeat), cards: [], trickNumber: 1 },
    completedTricks: [],
    baseCards: opts.baseCards ?? [6, 6],
    totalBaseCards: (opts.baseCards ?? [6, 6])[0] + (opts.baseCards ?? [6, 6])[1],
    kunukku: opts.kunukku ?? [0, 0, 0, 0],
    log: [],
  };
}

// A fabricated completed kai: only the winner and the points matter to the
// scorer, so the actual cards are placeholders.
export function trickWonBy(winnerSeat: Seat, points: number, trickNumber = 1): CompletedTrick {
  const filler: Card[] = cards('7S', '8S', 'QS', 'KS');
  return { trickNumber, cards: filler.map((c, i) => ({ seat: i as Seat, card: c })), winnerSeat, points };
}

export function pointsOf(list: Card[]): number {
  return list.reduce((sum, c) => sum + cardPoints(c), 0);
}
