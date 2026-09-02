import { legalCardsFor, resolveTrick } from './rules.js';
import { finishRound } from './scoring.js';
import { appendLog, expectedPlaySeat, playerName } from './state.js';
import { type Card, type GameState, type Seat, TOTAL_POINTS, cardId, teamOf } from './types.js';

export function requestTrumpReveal(state: GameState, seat: Seat): GameState {
  if (state.phase !== 'playing') throw new Error('Not in playing phase');
  if (state.trump.revealed) throw new Error('Trump already revealed');
  const ledSuit = state.trick.cards[0]?.card.suit ?? null;
  if (ledSuit === null) throw new Error('Cannot call for trump when leading');
  const canFollow = playableHand(state, seat).some((c) => c.suit === ledSuit);
  if (canFollow) throw new Error('You must be void in the led suit to call for trump');

  const trumpCard = state.trump.card;
  const cardLabel = trumpCard ? `${trumpCard.rank}${trumpCard.suit}` : (state.trump.suit as string);
  return {
    ...state,
    trump: { ...state.trump, revealed: true },
    // Having called for the trump, the caller must play a trump to this trick
    // if they hold one.
    mustTrumpSeat: seat,
    log: appendLog(
      state,
      `${playerName(state.players, seat)} calls for trump. The trump card is ${cardLabel}.`
    ),
  };
}

// The cards a seat may actually play right now. The bidder's set-aside trump
// card is held back while it stays concealed - it does not count for following
// suit either - unless it is the only card the bidder has left.
export function playableHand(state: GameState, seat: Seat): Card[] {
  const t = state.trump;
  if (t.chosenBySeat === seat && !t.revealed && t.card) {
    const rest = state.hands[seat].filter((c) => cardId(c) !== cardId(t.card as Card));
    return rest.length > 0 ? rest : state.hands[seat];
  }
  return state.hands[seat];
}

// The cards a seat may legally play to the current trick: follow suit if
// possible (the concealed set-aside trump neither plays nor forces a follow),
// and a player who just called for the trump must trump if able.
function legalPlaysFor(state: GameState, seat: Seat): Card[] {
  const ledSuit = state.trick.cards[0]?.card.suit ?? null;
  const base = legalCardsFor(playableHand(state, seat), ledSuit);
  if (state.mustTrumpSeat === seat && state.trump.revealed && state.trump.suit) {
    const trumps = base.filter((c) => c.suit === state.trump.suit);
    if (trumps.length > 0) return trumps;
  }
  return base;
}

export function playCard(state: GameState, seat: Seat, card: Card): GameState {
  if (state.phase !== 'playing') throw new Error('Not in playing phase');
  if (expectedPlaySeat(state.trick) !== seat) throw new Error('Not your turn to play');

  const hand = state.hands[seat];
  const idx = hand.findIndex((c) => cardId(c) === cardId(card));
  if (idx === -1) throw new Error('Card not in hand');

  const legal = legalPlaysFor(state, seat);
  if (!legal.some((c) => cardId(c) === cardId(card))) {
    throw new Error(
      state.mustTrumpSeat === seat
        ? 'Having called for the trump, you must play a trump'
        : 'Illegal card: must follow suit if possible'
    );
  }

  const log: string[] = [];

  // If nobody ever called for the trump, the bidder's last card is the
  // set-aside trump itself - playing it exposes it, and from that moment it
  // counts as a trump.
  let trump = state.trump;
  if (
    !trump.revealed &&
    trump.card &&
    trump.chosenBySeat === seat &&
    cardId(card) === cardId(trump.card)
  ) {
    trump = { ...trump, revealed: true };
    log.push(`${playerName(state.players, seat)} is forced to expose the trump: ${card.rank}${card.suit}.`);
  }

  const hands = structuredClone(state.hands) as GameState['hands'];
  hands[seat] = hands[seat].filter((c) => cardId(c) !== cardId(card));

  const trick = structuredClone(state.trick);
  // Record whether the trump was already exposed when this card was played -
  // a trump-suit card played before the exposure never counts as a trump.
  trick.cards.push({ seat, card, playedAfterReveal: trump.revealed });

  log.push(`${playerName(state.players, seat)} plays ${card.rank}${card.suit}.`);

  // The must-trump obligation only covers the caller's own play.
  const mustTrumpSeat = state.mustTrumpSeat === seat ? null : state.mustTrumpSeat;

  if (trick.cards.length < 4) {
    return { ...state, hands, trick, trump, mustTrumpSeat, log: appendLog(state, ...log) };
  }

  // Trick complete. Trump only has power once it has been revealed, and only
  // for the cards played after the reveal (resolveTrick checks per card).
  const activeTrump = trump.revealed ? trump.suit : null;
  const completed = resolveTrick(trick.cards, activeTrump, trick.trickNumber);
  const completedTricks = [...state.completedTricks, completed];
  log.push(`${playerName(state.players, completed.winnerSeat)} wins the kai (${completed.points} pts).`);

  if (completedTricks.length === 8) {
    return finishRound({ ...state, hands, trick, trump, mustTrumpSeat, completedTricks, log: appendLog(state, ...log) });
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
    return finishRound({ ...state, hands, trick, trump, mustTrumpSeat, completedTricks, log: appendLog(state, ...log) });
  }

  const newTrick = { leadSeat: completed.winnerSeat, cards: [], trickNumber: trick.trickNumber + 1 };
  return { ...state, hands, trick: newTrick, trump, mustTrumpSeat, completedTricks, log: appendLog(state, ...log) };
}

export function getCurrentActorSeat(state: Pick<GameState, 'phase' | 'bidding' | 'trick'>): Seat | null {
  if (state.phase === 'bidding') return state.bidding.turnSeat;
  if (state.phase === 'trump_selection') return state.bidding.currentBidderSeat;
  if (state.phase === 'playing') return expectedPlaySeat(state.trick);
  return null;
}

export function getLegalCards(state: GameState, seat: Seat): Card[] {
  if (state.phase !== 'playing') return [];
  if (expectedPlaySeat(state.trick) !== seat) return [];
  return legalPlaysFor(state, seat);
}

export function canRequestTrumpReveal(state: GameState, seat: Seat): boolean {
  if (state.phase !== 'playing') return false;
  if (state.trump.revealed) return false;
  if (expectedPlaySeat(state.trick) !== seat) return false;
  const ledSuit = state.trick.cards[0]?.card.suit ?? null;
  if (ledSuit === null) return false;
  return !playableHand(state, seat).some((c) => c.suit === ledSuit);
}

export { TOTAL_POINTS };
