import {
  GameState,
  Player,
  Seat,
  TOTAL_POINTS,
  chooseTrump,
  createGame,
  decideBotAction,
  getPlayerView,
  placeBid,
  playCard,
  requestTrumpReveal,
  startNextRound,
} from './index.js';

function makePlayers(): Player[] {
  return [0, 1, 2, 3].map((seat) => ({
    id: `bot${seat}`,
    name: `Bot ${seat}`,
    seat: seat as Seat,
    isBot: true,
    connected: true,
  }));
}

function playOneRound(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.phase === 'bidding') {
    guard++;
    if (guard > 200) throw new Error('Bidding stuck in a loop');
    const seat = s.bidding.turnSeat;
    const view = getPlayerView(s, seat);
    const action = decideBotAction(view);
    if (action.type !== 'bid') throw new Error('Expected bid action');
    s = placeBid(s, seat, action.value);
  }

  if (s.phase === 'trump_selection') {
    const seat = s.bidding.currentBidderSeat as Seat;
    const view = getPlayerView(s, seat);
    const action = decideBotAction(view);
    if (action.type !== 'trump') throw new Error('Expected trump action');
    s = chooseTrump(s, seat, action.suit);
  }

  guard = 0;
  while (s.phase === 'playing') {
    guard++;
    if (guard > 500) throw new Error('Playing stuck in a loop');
    const seat = s.trick.cards.length === 0 ? (s.trick.leadSeat as Seat) : (((s.trick.cards[s.trick.cards.length - 1].seat + 1) % 4) as Seat);
    const view = getPlayerView(s, seat);
    const action = decideBotAction(view);
    if (action.type === 'reveal') {
      s = requestTrumpReveal(s, seat);
    } else if (action.type === 'play') {
      s = playCard(s, seat, action.card);
    } else {
      throw new Error(`Unexpected action ${action.type} during play`);
    }
  }

  return s;
}

function assertInvariants(s: GameState) {
  const totalPoints = s.completedTricks.reduce((sum, t) => sum + t.points, 0);
  if (totalPoints !== TOTAL_POINTS) {
    throw new Error(`Expected total points ${TOTAL_POINTS}, got ${totalPoints}`);
  }
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    if (s.hands[seat].length !== 0) {
      throw new Error(`Seat ${seat} still has ${s.hands[seat].length} cards after round`);
    }
  }
  const cardSet = new Set<string>();
  for (const t of s.completedTricks) {
    for (const pc of t.cards) {
      const id = `${pc.card.rank}${pc.card.suit}`;
      if (cardSet.has(id)) throw new Error(`Duplicate card played: ${id}`);
      cardSet.add(id);
    }
  }
  if (cardSet.size !== 32) throw new Error(`Expected 32 unique cards played, got ${cardSet.size}`);
}

function runFullGame(gameIndex: number) {
  const players = makePlayers();
  let state = createGame(players, { targetScore: 6 });
  let rounds = 0;
  while (state.phase !== 'game_end') {
    rounds++;
    if (rounds > 100) throw new Error('Game did not converge to a winner');
    state = playOneRound(state);
    assertInvariants(state);
    if (state.phase === 'round_end') {
      state = startNextRound(state);
    }
  }
  const last = state.history[state.history.length - 1];
  console.log(
    `Game ${gameIndex}: winner=Team ${state.winner} after ${rounds} rounds, final score ${state.scores[0]}-${state.scores[1]}, last round bid=${last.bid} made=${last.made}`
  );
}

const GAMES = 200;
for (let i = 1; i <= GAMES; i++) {
  runFullGame(i);
}
console.log(`\nAll ${GAMES} simulated games completed with valid invariants.`);
