export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Strength order within a suit for trick-taking, weakest to strongest.
export const STRENGTH_ORDER: Rank[] = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];

export const CARD_POINTS: Record<Rank, number> = {
  '7': 0,
  '8': 0,
  Q: 0,
  K: 0,
  '10': 1,
  A: 1,
  '9': 2,
  J: 3,
};

export const TOTAL_POINTS = 28;

export function cardId(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardStrength(card: Card): number {
  return STRENGTH_ORDER.indexOf(card.rank);
}

export function cardPoints(card: Card): number {
  return CARD_POINTS[card.rank];
}

export type Seat = 0 | 1 | 2 | 3;
export const SEATS: Seat[] = [0, 1, 2, 3];

export function teamOf(seat: Seat): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

export interface Player {
  id: string;
  name: string;
  seat: Seat;
  isBot: boolean;
  connected: boolean;
}

export type Phase =
  | 'lobby'
  | 'bidding'
  | 'trump_selection'
  | 'doubling'
  | 'redoubling'
  | 'playing'
  | 'round_end'
  | 'game_end';

export interface BiddingState {
  turnSeat: Seat;
  minBid: number;
  maxBid: number;
  currentBid: number | null;
  currentBidderSeat: Seat | null;
  passed: [boolean, boolean, boolean, boolean];
  history: { seat: Seat; action: 'pass' | number }[];
}

export interface TrumpState {
  suit: Suit | null;
  card: Card | null; // the specific card set aside face-down as the trump
  chosenBySeat: Seat | null;
  revealed: boolean;
}

export interface PlayedCard {
  seat: Seat;
  card: Card;
}

export interface TrickState {
  leadSeat: Seat | null;
  cards: PlayedCard[];
  trickNumber: number; // 1-8
}

export interface CompletedTrick {
  trickNumber: number;
  cards: PlayedCard[];
  winnerSeat: Seat;
  points: number;
}

export interface RoundResult {
  roundNumber: number;
  biddingTeam: 0 | 1;
  bid: number;
  pointsCaptured: [number, number];
  made: boolean;
  kappu: boolean; // bidding team won all 8 tricks
  doubled: boolean; // defenders doubled the stakes after trump was named
  redoubled: boolean; // bidding team answered the double with a redouble
  stakeMultiplier: number; // 1 normal, 2 doubled, 4 redoubled
  roundWinnerTeam: 0 | 1; // biddingTeam if the bid was made, the defenders otherwise
  cardsTransferred: number; // base cards handed from the losing team to the winning team
  baseCardsAfter: [number, number]; // base-card tallies once the transfer is applied
  kunukkuMarked: Seat[]; // seats freshly marked with a kunukku this round (shut out as defenders)
  kunukkuCleared: Seat[]; // seats whose kunukku was cleared this round
  kunukkuDoubled: Seat[]; // seats whose kunukku was doubled this round (failed a clearance attempt)
  kunukkuBlockedWinner: 0 | 1 | null; // team that reached the target score but is held back by a kunukku mark
}

// Kunukku ("earring") is a per-seat shame penalty: 0 = clear, 1 = marked, 2 = doubled.
export type KunukkuLevel = 0 | 1 | 2;

export interface GameState {
  players: Player[];
  dealerSeat: Seat;
  phase: Phase;
  hands: [Card[], Card[], Card[], Card[]];
  stock: [Card[], Card[], Card[], Card[]];
  firstBatchSize: number;
  secondBatchDealt: boolean;
  bidding: BiddingState;
  trump: TrumpState;
  trick: TrickState;
  completedTricks: CompletedTrick[];
  // Base cards are the match's physical score tokens: each team starts with
  // half of totalBaseCards face down, hands one to the winners after every
  // lost round, and the match is won by collecting all of them.
  baseCards: [number, number];
  totalBaseCards: number;
  // Stake state for the current round: defenders may double after trump is
  // named, the bidding team may answer with a redouble (1 -> 2 -> 4 cards).
  stakeMultiplier: 1 | 2 | 4;
  doubled: boolean;
  redoubled: boolean;
  roundNumber: number;
  history: RoundResult[];
  log: string[];
  winner: 0 | 1 | null;
  kunukku: [KunukkuLevel, KunukkuLevel, KunukkuLevel, KunukkuLevel];
}

export interface PlayerView {
  you: Seat;
  players: Player[];
  dealerSeat: Seat;
  phase: Phase;
  hand: Card[];
  handCounts: [number, number, number, number];
  secondBatchDealt: boolean;
  bidding: BiddingState;
  trump: {
    suit: Suit | null; // null if concealed and you are not the chooser
    card: Card | null; // the set-aside trump card, shown only to the chooser until revealed
    concealedForYou: boolean;
    chosenBySeat: Seat | null;
    revealed: boolean;
  };
  trick: TrickState;
  completedTricks: CompletedTrick[];
  baseCards: [number, number];
  totalBaseCards: number;
  stakeMultiplier: 1 | 2 | 4;
  doubled: boolean;
  redoubled: boolean;
  roundNumber: number;
  history: RoundResult[];
  log: string[];
  winner: 0 | 1 | null;
  canRequestTrumpReveal: boolean;
  legalCards: Card[];
  kunukku: [KunukkuLevel, KunukkuLevel, KunukkuLevel, KunukkuLevel];
}
