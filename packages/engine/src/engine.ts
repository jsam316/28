import { buildDeck, shuffle } from './deck.js';
import { bidTierStake, legalCardsFor, minNextBid, resolveTrick } from './rules.js';
import {
  type BiddingState,
  type Card,
  type GameState,
  type KunukkuLevel,
  type Player,
  type RoundResult,
  type Seat,
  type Suit,
  TOTAL_POINTS,
  cardId,
  nextSeat,
  teamOf,
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
    trump: { suit: null, chosenBySeat: null, revealed: false },
    trick: { leadSeat: null, cards: [], trickNumber: 1 },
    completedTricks: [],
    baseCards,
    totalBaseCards,
    stakeMultiplier: 1,
    doubled: false,
    redoubled: false,
    roundNumber,
    history,
    log: [`Round ${roundNumber}: cards dealt. ${playerName(players, openingBidder)} opens the bidding.`],
    winner: null,
    kunukku,
  };
}

function playerName(players: Player[], seat: Seat): string {
  return players.find((p) => p.seat === seat)?.name ?? `Seat ${seat}`;
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

export function startNextRound(state: GameState, options: GameOptions = {}): GameState {
  const opts: Required<GameOptions> = {
    baseCardsPerTeam: state.totalBaseCards / 2,
    minBid: state.bidding.minBid,
    maxBid: state.bidding.maxBid,
    rng: options.rng ?? Math.random,
  };
  const dealerSeat = nextSeat(state.dealerSeat);
  return dealRound(
    state.players,
    dealerSeat,
    state.baseCards,
    state.totalBaseCards,
    state.roundNumber + 1,
    opts,
    state.history,
    state.kunukku
  );
}

function cloneLog(state: GameState, ...lines: string[]): string[] {
  return [...state.log, ...lines];
}

function dealSecondBatch(state: GameState): { hands: GameState['hands']; stock: GameState['stock'] } {
  const hands = structuredClone(state.hands) as GameState['hands'];
  const stock = structuredClone(state.stock) as GameState['stock'];
  for (let s = 0; s < 4; s++) {
    hands[s as Seat].push(...stock[s as Seat]);
    stock[s as Seat] = [];
  }
  return { hands, stock };
}

export function placeBid(state: GameState, seat: Seat, action: 'pass' | number): GameState {
  if (state.phase !== 'bidding') throw new Error('Not in bidding phase');
  if (state.bidding.turnSeat !== seat) throw new Error('Not your turn to bid');
  if (state.bidding.passed[seat]) throw new Error('You already passed');

  const bidding = structuredClone(state.bidding);
  const log: string[] = [];

  if (action === 'pass') {
    bidding.passed[seat] = true;
    log.push(`${playerName(state.players, seat)} passes.`);
  } else {
    const minAllowed = minNextBid(bidding.currentBid, bidding.minBid, state.secondBatchDealt);
    if (action < minAllowed) throw new Error(`Bid must be at least ${minAllowed}`);
    if (action > bidding.maxBid) throw new Error(`Bid cannot exceed ${bidding.maxBid}`);
    bidding.currentBid = action;
    bidding.currentBidderSeat = seat;
    log.push(`${playerName(state.players, seat)} bids ${action}.`);
  }

  bidding.history.push({ seat, action });

  const remaining: Seat[] = [0, 1, 2, 3].filter((s) => !bidding.passed[s as Seat]) as Seat[];

  let concluded = false;

  if (remaining.length === 0) {
    concluded = true;
    if (bidding.currentBidderSeat === null) {
      // Nobody has bid at all yet (only possible in the first bidding
      // stage): dealer is forced to take the minimum bid.
      bidding.currentBid = bidding.minBid;
      bidding.currentBidderSeat = state.dealerSeat;
      log.push(
        `Everyone passed. ${playerName(state.players, state.dealerSeat)} is forced to take the bid at ${bidding.minBid}.`
      );
    } else {
      // Someone already holds a bid and nobody wants to raise further
      // (the normal way the second stage ends): their bid stands.
      log.push(
        `No further raises. ${playerName(state.players, bidding.currentBidderSeat)} holds the bid at ${bidding.currentBid}.`
      );
    }
  } else if (remaining.length === 1 && bidding.currentBidderSeat !== null) {
    concluded = true;
    log.push(
      `Bidding closed. ${playerName(state.players, bidding.currentBidderSeat)} wins the bid at ${bidding.currentBid}.`
    );
  }

  if (!concluded) {
    let next = nextSeat(seat);
    while (bidding.passed[next]) next = nextSeat(next);
    bidding.turnSeat = next;
    return { ...state, bidding, log: cloneLog(state, ...log) };
  }

  if (!state.secondBatchDealt) {
    // End of the first bidding stage: deal the rest of the hand and reopen
    // bidding for the second stage, now that everyone can see all 8 cards.
    const { hands, stock } = dealSecondBatch(state);
    const reopened: BiddingState = {
      ...bidding,
      passed: [false, false, false, false],
      turnSeat: nextSeat(state.dealerSeat),
    };
    log.push(
      `The rest of the hand is dealt. ${playerName(state.players, reopened.turnSeat)} opens the second bidding round.`
    );
    return {
      ...state,
      hands,
      stock,
      secondBatchDealt: true,
      bidding: reopened,
      log: cloneLog(state, ...log),
    };
  }

  return {
    ...state,
    bidding,
    phase: 'trump_selection',
    log: cloneLog(state, ...log),
  };
}

function beginPlay(state: GameState, log: string[]): GameState {
  const leadSeat = nextSeat(state.dealerSeat);
  return {
    ...state,
    phase: 'playing',
    trick: { leadSeat, cards: [], trickNumber: 1 },
    log: cloneLog(state, ...log),
  };
}

export function chooseTrump(state: GameState, seat: Seat, suit: Suit): GameState {
  if (state.phase !== 'trump_selection') throw new Error('Not in trump selection phase');
  if (state.bidding.currentBidderSeat !== seat) throw new Error('Only the bid winner chooses trump');

  const deciderSeat = nextSeat(seat);
  return {
    ...state,
    trump: { suit, chosenBySeat: seat, revealed: false },
    phase: 'doubling',
    log: cloneLog(
      state,
      `${playerName(state.players, seat)} picks trump (concealed).`,
      `${playerName(state.players, deciderSeat)} may double the stakes.`
    ),
  };
}

// The defender to the bidder's left speaks for the defending team: yell
// "Double!" to put 2 base cards on the line, or let the round play at 1.
export function declareDouble(state: GameState, seat: Seat, wantsDouble: boolean): GameState {
  if (state.phase !== 'doubling') throw new Error('Not in doubling phase');
  const bidderSeat = state.bidding.currentBidderSeat as Seat;
  if (seat !== nextSeat(bidderSeat)) throw new Error('Only the defender after the bidder declares the double');

  if (!wantsDouble) {
    return beginPlay(state, ['No double. Play begins.']);
  }
  return {
    ...state,
    stakeMultiplier: 2,
    doubled: true,
    phase: 'redoubling',
    log: cloneLog(
      state,
      `${playerName(state.players, seat)} yells DOUBLE! 2 base cards on the line.`,
      `${playerName(state.players, bidderSeat)} may answer with a redouble.`
    ),
  };
}

// The bidder answers a double: redouble to 4 base cards, or accept at 2.
export function declareRedouble(state: GameState, seat: Seat, wantsRedouble: boolean): GameState {
  if (state.phase !== 'redoubling') throw new Error('Not in redoubling phase');
  const bidderSeat = state.bidding.currentBidderSeat as Seat;
  if (seat !== bidderSeat) throw new Error('Only the bidder answers a double');

  if (!wantsRedouble) {
    return beginPlay(state, ['Double accepted. Play begins at 2 base cards.']);
  }
  return beginPlay(
    { ...state, stakeMultiplier: 4, redoubled: true },
    [`${playerName(state.players, seat)} answers REDOUBLE! 4 base cards on the line. Play begins.`]
  );
}

export function requestTrumpReveal(state: GameState, seat: Seat): GameState {
  if (state.phase !== 'playing') throw new Error('Not in playing phase');
  if (state.trump.revealed) throw new Error('Trump already revealed');
  const ledSuit = state.trick.cards[0]?.card.suit ?? null;
  if (ledSuit === null) throw new Error('Cannot call for trump when leading');
  const hand = state.hands[seat];
  const canFollow = hand.some((c) => c.suit === ledSuit);
  if (canFollow) throw new Error('You must be void in the led suit to call for trump');

  return {
    ...state,
    trump: { ...state.trump, revealed: true },
    log: cloneLog(
      state,
      `${playerName(state.players, seat)} calls for trump. Trump is ${state.trump.suit}.`
    ),
  };
}

export function playCard(state: GameState, seat: Seat, card: Card): GameState {
  if (state.phase !== 'playing') throw new Error('Not in playing phase');
  const expectedSeat =
    state.trick.cards.length === 0 ? state.trick.leadSeat : nextSeat(state.trick.cards[state.trick.cards.length - 1].seat);
  if (expectedSeat !== seat) throw new Error('Not your turn to play');

  const hand = state.hands[seat];
  const idx = hand.findIndex((c) => cardId(c) === cardId(card));
  if (idx === -1) throw new Error('Card not in hand');

  const ledSuit = state.trick.cards[0]?.card.suit ?? null;
  const legal = legalCardsFor(hand, ledSuit);
  if (!legal.some((c) => cardId(c) === cardId(card))) {
    throw new Error('Illegal card: must follow suit if possible');
  }

  const hands = structuredClone(state.hands) as GameState['hands'];
  hands[seat] = hands[seat].filter((c) => cardId(c) !== cardId(card));

  const trick = structuredClone(state.trick);
  trick.cards.push({ seat, card });

  let log: string[] = [`${playerName(state.players, seat)} plays ${card.rank}${card.suit}.`];

  if (trick.cards.length < 4) {
    return { ...state, hands, trick, log: cloneLog(state, ...log) };
  }

  // Trick complete.
  // Trump only has power once it has been revealed; a concealed trump card is
  // just an ordinary off-suit discard and cannot win the kai.
  const activeTrump = state.trump.revealed ? state.trump.suit : null;
  const completed = resolveTrick(trick.cards, activeTrump, trick.trickNumber);
  const completedTricks = [...state.completedTricks, completed];
  log.push(`${playerName(state.players, completed.winnerSeat)} wins the kai (${completed.points} pts).`);

  if (completedTricks.length === 8) {
    return finishRound({ ...state, hands, trick, completedTricks, log: cloneLog(state, ...log) });
  }

  // End the round the moment the outcome is settled: if the defending team has
  // already captured more than (28 - bid), the bidding team can no longer reach
  // its bid however the remaining kai fall, so the bid has failed - stop here.
  const biddingTeam = teamOf(state.bidding.currentBidderSeat as Seat);
  const defendingTeam = biddingTeam === 0 ? 1 : 0;
  const defenderPoints = completedTricks
    .filter((t) => teamOf(t.winnerSeat) === defendingTeam)
    .reduce((sum, t) => sum + t.points, 0);
  const bid = state.bidding.currentBid as number;
  if (defenderPoints > TOTAL_POINTS - bid) {
    log.push(
      `Defenders have ${defenderPoints} pts — the bid of ${bid} can no longer be made. The round ends early.`
    );
    return finishRound({ ...state, hands, trick, completedTricks, log: cloneLog(state, ...log) });
  }

  const newTrick = { leadSeat: completed.winnerSeat, cards: [], trickNumber: trick.trickNumber + 1 };
  return { ...state, hands, trick: newTrick, completedTricks, log: cloneLog(state, ...log) };
}

function finishRound(state: GameState): GameState {
  const pointsCaptured: [number, number] = [0, 0];
  const tricksWonByTeam: [number, number] = [0, 0];
  for (const t of state.completedTricks) {
    const team = teamOf(t.winnerSeat);
    pointsCaptured[team] += t.points;
    tricksWonByTeam[team] += 1;
  }

  const biddingTeam = teamOf(state.bidding.currentBidderSeat as Seat);
  const otherTeam = biddingTeam === 0 ? 1 : 0;
  const bidderSeat = state.bidding.currentBidderSeat as Seat;
  const bid = state.bidding.currentBid as number;
  const made = pointsCaptured[biddingTeam] >= bid;
  const kappu = tricksWonByTeam[biddingTeam] === 8;

  // The base-card exchange: the losing team hands base cards to the winners.
  // The bid tier auto-scales the stake (20-23 doubles it, 24+ quadruples it),
  // and a table double/redouble multiplies that again.
  const roundWinnerTeam: 0 | 1 = made ? biddingTeam : otherTeam;
  const roundLoserTeam: 0 | 1 = roundWinnerTeam === 0 ? 1 : 0;
  const loserEnteredAtZero = state.baseCards[roundLoserTeam] === 0;
  const effectiveStake = bidTierStake(bid) * state.stakeMultiplier;
  const cardsTransferred = Math.min(effectiveStake, state.baseCards[roundLoserTeam]);
  const baseCards: [number, number] = [...state.baseCards];
  baseCards[roundLoserTeam] -= cardsTransferred;
  baseCards[roundWinnerTeam] += cardsTransferred;

  // --- Kunukku (ear-clip) bookkeeping ---
  // Each seat wears 0-2 clips. Per the authentic rule, a kunukku is shed ONLY
  // by winning your own bid as declarer - never by defending. A made low bid
  // frees just the bidder's own clip; a made bid of 20+ (which stakes 2-4
  // cards) frees both partners, so one clip is shed per staked base card.
  const kunukku = [...state.kunukku] as [KunukkuLevel, KunukkuLevel, KunukkuLevel, KunukkuLevel];
  const kunukkuMarked: Seat[] = [];
  const kunukkuCleared: Seat[] = [];
  const kunukkuDoubled: Seat[] = [];
  const partnerOf = (s: Seat) => ((s + 2) % 4) as Seat;
  const addClip = (s: Seat) => {
    if (kunukku[s] >= 2) return;
    kunukku[s] = (kunukku[s] + 1) as KunukkuLevel;
    (kunukku[s] === 1 ? kunukkuMarked : kunukkuDoubled).push(s);
  };

  // Clip removal: only the declaring team, only on a made bid. Sheds one clip
  // per staked base card starting from the bidder, then the partner.
  if (made) {
    let removable = effectiveStake;
    for (const s of [bidderSeat, partnerOf(bidderSeat)]) {
      while (removable > 0 && kunukku[s] > 0) {
        kunukku[s] = (kunukku[s] - 1) as KunukkuLevel;
        removable--;
        if (!kunukkuCleared.includes(s)) kunukkuCleared.push(s);
      }
    }
  }

  // Clip additions. Per the authentic Kerala rule, a kunukku is a TEAM penalty
  // that lands only when a team's balance is wiped out - both players are
  // clipped when the team is stripped of its last base card. A single failed
  // bid or a shut-out on its own does NOT clip anyone; it only matters if it
  // strips the team to zero.
  if (cardsTransferred > 0 && baseCards[roundLoserTeam] === 0) {
    for (const s of ([0, 1, 2, 3] as Seat[]).filter((s) => teamOf(s) === roundLoserTeam)) {
      addClip(s);
    }
  }
  // Sinking deeper (double kunukku): an already-clipped bidder who declares to
  // redeem their kunukku and then fails takes a second clip - on their other
  // ear, or the partner if both the bidder's ears are already full.
  if (!made && state.kunukku[bidderSeat] > 0) {
    addClip(kunukku[bidderSeat] < 2 ? bidderSeat : partnerOf(bidderSeat));
  }

  const log = [
    ...state.log,
    made
      ? `Bidding team captured ${pointsCaptured[biddingTeam]} pts (needed ${bid}) — bid made${kappu ? ' with a KAPPU (all 8 kai)!' : '.'}`
      : `Bidding team captured only ${pointsCaptured[biddingTeam]} pts (needed ${bid}) — bid failed.`,
    cardsTransferred > 0
      ? `Team ${roundLoserTeam === 0 ? 'A' : 'B'} hands over ${cardsTransferred} base card${cardsTransferred > 1 ? 's' : ''}${effectiveStake > 1 ? ` (stakes: ${bid >= 24 ? '24+ quadruple' : bid >= 20 ? '20+ double' : 'standard'}${state.doubled ? state.redoubled ? ', redoubled' : ', doubled' : ''})` : ''}. Base cards: Team A ${baseCards[0]} - Team B ${baseCards[1]}.`
      : `Team ${roundLoserTeam === 0 ? 'A' : 'B'} has no base cards left to hand over.`,
  ];
  for (const s of kunukkuMarked) log.push(`${playerName(state.players, s)} wears a kunukku clip!`);
  for (const s of kunukkuCleared) log.push(`${playerName(state.players, s)} sheds a kunukku clip!`);
  for (const s of kunukkuDoubled) log.push(`${playerName(state.players, s)} takes a second kunukku clip!`);
  if (cardsTransferred > 0 && baseCards[roundLoserTeam] === 0) {
    log.push(
      `Team ${roundLoserTeam === 0 ? 'A' : 'B'} is stripped of base cards — kunukku state! They must win a round to survive.`
    );
  }

  // Match end: reaching 12-0 alone doesn't finish it. The stripped team gets
  // a last stand - if they lose yet another round while already at zero,
  // they are broken and the match is over.
  let winner: 0 | 1 | null = loserEnteredAtZero ? roundWinnerTeam : null;
  let kunukkuBlockedWinner: 0 | 1 | null = null;
  if (winner !== null) {
    const winningSeats = ([0, 1, 2, 3] as Seat[]).filter((s) => teamOf(s) === winner);
    if (winningSeats.some((s) => kunukku[s] > 0)) {
      kunukkuBlockedWinner = winner;
      log.push(
        `Team ${winner === 0 ? 'A' : 'B'} had the match won but must clear their own kunukku first!`
      );
      winner = null;
    } else {
      log.push(
        `Team ${roundLoserTeam === 0 ? 'A' : 'B'} had nothing left to give — Team ${winner === 0 ? 'A' : 'B'} breaks them and wins the match!`
      );
    }
  }

  const result: RoundResult = {
    roundNumber: state.roundNumber,
    biddingTeam,
    bid,
    pointsCaptured,
    made,
    kappu,
    doubled: state.doubled,
    redoubled: state.redoubled,
    stakeMultiplier: state.stakeMultiplier,
    roundWinnerTeam,
    cardsTransferred,
    baseCardsAfter: baseCards,
    kunukkuMarked,
    kunukkuCleared,
    kunukkuDoubled,
    kunukkuBlockedWinner,
  };

  return {
    ...state,
    phase: winner !== null ? 'game_end' : 'round_end',
    baseCards,
    history: [...state.history, result],
    log,
    winner,
    trump: { ...state.trump, revealed: true },
    kunukku,
  };
}

export function getCurrentActorSeat(state: Pick<GameState, 'phase' | 'bidding' | 'trick'>): Seat | null {
  if (state.phase === 'bidding') return state.bidding.turnSeat;
  if (state.phase === 'trump_selection') return state.bidding.currentBidderSeat;
  if (state.phase === 'doubling') return nextSeat(state.bidding.currentBidderSeat as Seat);
  if (state.phase === 'redoubling') return state.bidding.currentBidderSeat;
  if (state.phase === 'playing') {
    return state.trick.cards.length === 0
      ? (state.trick.leadSeat as Seat)
      : (((state.trick.cards[state.trick.cards.length - 1].seat + 1) % 4) as Seat);
  }
  return null;
}

export function getLegalCards(state: GameState, seat: Seat): Card[] {
  if (state.phase !== 'playing') return [];
  const expectedSeat =
    state.trick.cards.length === 0 ? state.trick.leadSeat : nextSeat(state.trick.cards[state.trick.cards.length - 1].seat);
  if (expectedSeat !== seat) return [];
  const ledSuit = state.trick.cards[0]?.card.suit ?? null;
  return legalCardsFor(state.hands[seat], ledSuit);
}

export function canRequestTrumpReveal(state: GameState, seat: Seat): boolean {
  if (state.phase !== 'playing') return false;
  if (state.trump.revealed) return false;
  const expectedSeat =
    state.trick.cards.length === 0 ? state.trick.leadSeat : nextSeat(state.trick.cards[state.trick.cards.length - 1].seat);
  if (expectedSeat !== seat) return false;
  const ledSuit = state.trick.cards[0]?.card.suit ?? null;
  if (ledSuit === null) return false;
  return !state.hands[seat].some((c) => c.suit === ledSuit);
}

export { TOTAL_POINTS };
