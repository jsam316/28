import {
  type BotDifficulty,
  type GameState,
  type Player,
  type Seat,
  TOTAL_POINTS,
  bidTierStake,
  chooseTrump,
  createGame,
  decideBotAction,
  declareDouble,
  declareRedouble,
  getCurrentActorSeat,
  getPlayerView,
  minNextBid,
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

function playOneRound(state: GameState, difficulty: BotDifficulty): GameState {
  let s = state;
  let guard = 0;
  while (s.phase === 'bidding') {
    guard++;
    if (guard > 200) throw new Error('Bidding stuck in a loop');
    const seat = s.bidding.turnSeat;
    const view = getPlayerView(s, seat);
    const action = decideBotAction(view, difficulty);
    if (action.type !== 'bid') throw new Error('Expected bid action');
    if (typeof action.value === 'number') {
      const required = minNextBid(s.bidding.currentBid, s.bidding.minBid, s.secondBatchDealt);
      if (action.value < required) {
        throw new Error(
          `Bot bid ${action.value} below the required minimum ${required} (secondBatchDealt=${s.secondBatchDealt})`
        );
      }
    }
    s = placeBid(s, seat, action.value);
  }

  if (s.phase === 'trump_selection') {
    const seat = s.bidding.currentBidderSeat as Seat;
    const view = getPlayerView(s, seat);
    const action = decideBotAction(view, difficulty);
    if (action.type !== 'trump') throw new Error('Expected trump action');
    s = chooseTrump(s, seat, action.suit);
  }

  if (s.phase === 'doubling') {
    const seat = getCurrentActorSeat(s) as Seat;
    const view = getPlayerView(s, seat);
    const action = decideBotAction(view, difficulty);
    if (action.type !== 'double') throw new Error('Expected double action');
    if (action.accept) doubleStats.doubles++;
    s = declareDouble(s, seat, action.accept);
  }

  if (s.phase === 'redoubling') {
    const seat = getCurrentActorSeat(s) as Seat;
    const view = getPlayerView(s, seat);
    const action = decideBotAction(view, difficulty);
    if (action.type !== 'redouble') throw new Error('Expected redouble action');
    if (action.accept) doubleStats.redoubles++;
    s = declareRedouble(s, seat, action.accept);
  }

  guard = 0;
  while (s.phase === 'playing') {
    guard++;
    if (guard > 500) throw new Error('Playing stuck in a loop');
    const seat = s.trick.cards.length === 0 ? (s.trick.leadSeat as Seat) : (((s.trick.cards[s.trick.cards.length - 1].seat + 1) % 4) as Seat);
    const view = getPlayerView(s, seat);
    const action = decideBotAction(view, difficulty);
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

const kunukkuStats = { marked: 0, cleared: 0, doubled: 0, blockedWins: 0, zeroStrips: 0 };
const doubleStats = { doubles: 0, redoubles: 0 };

function assertInvariants(s: GameState, roundsCompletedSoFar: number) {
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

  // The final trick's 4 cards must survive into the round-end state so the
  // UI can actually render/animate the last card played, not just the
  // engine's internal bookkeeping of who won it.
  if (s.trick.cards.length !== 4) {
    throw new Error(`Expected the final trick to retain all 4 cards, got ${s.trick.cards.length}`);
  }

  // Match history must accumulate across rounds, not reset - this is what
  // backs the running points-captured total shown in the UI.
  if (s.history.length !== roundsCompletedSoFar) {
    throw new Error(`Expected history to have ${roundsCompletedSoFar} entries, got ${s.history.length}`);
  }
  const historyPointsTotal = s.history.reduce((sum, r) => sum + r.pointsCaptured[0] + r.pointsCaptured[1], 0);
  if (historyPointsTotal !== TOTAL_POINTS * roundsCompletedSoFar) {
    throw new Error(
      `Expected cumulative history points ${TOTAL_POINTS * roundsCompletedSoFar}, got ${historyPointsTotal}`
    );
  }
}

function runFullGame(gameIndex: number, difficulty: BotDifficulty) {
  const players = makePlayers();
  let state = createGame(players, { baseCardsPerTeam: 6 });
  let rounds = 0;
  while (state.phase !== 'game_end') {
    rounds++;
    if (rounds > 2000) throw new Error('Game did not converge to a winner (possible base-card/kunukku deadlock)');
    state = playOneRound(state, difficulty);
    assertInvariants(state, rounds);
    for (const k of state.kunukku) {
      if (k !== 0 && k !== 1 && k !== 2) throw new Error(`Invalid kunukku level ${k}`);
    }
    if (state.baseCards[0] + state.baseCards[1] !== state.totalBaseCards) {
      throw new Error(
        `Base cards leaked: ${state.baseCards[0]} + ${state.baseCards[1]} != ${state.totalBaseCards}`
      );
    }
    if (state.baseCards[0] < 0 || state.baseCards[1] < 0) {
      throw new Error(`Negative base-card count: ${state.baseCards[0]}, ${state.baseCards[1]}`);
    }
    // Authentic-rule sanity: a kunukku is only ever shed by the declaring team
    // on a made bid. If anyone shed a clip this round, that team must be the
    // team that just made a bid.
    const r = state.history[state.history.length - 1];
    if (r.kunukkuCleared.length > 0 && !r.made) {
      throw new Error(`Clips cleared on a failed bid (round ${r.roundNumber})`);
    }
    for (const s of r.kunukkuCleared) {
      if (s % 2 !== r.biddingTeam) {
        throw new Error(`Seat ${s} shed a clip but is not on the declaring team ${r.biddingTeam}`);
      }
    }
    const lastResult = state.history[state.history.length - 1];
    kunukkuStats.marked += lastResult.kunukkuMarked.length;
    kunukkuStats.cleared += lastResult.kunukkuCleared.length;
    kunukkuStats.doubled += lastResult.kunukkuDoubled.length;
    if (lastResult.kunukkuBlockedWinner !== null) kunukkuStats.blockedWins++;
    if (![1, 2, 4].includes(lastResult.stakeMultiplier)) {
      throw new Error(`Invalid stake multiplier ${lastResult.stakeMultiplier}`);
    }
    const fullStake = bidTierStake(lastResult.bid) * lastResult.stakeMultiplier;
    // The loser hands over the full staked amount, capped only by however many
    // base cards they had before the round.
    const loserTeam = lastResult.roundWinnerTeam === 0 ? 1 : 0;
    const loserBefore = lastResult.baseCardsAfter[loserTeam] + lastResult.cardsTransferred;
    const expectedTransfer = Math.min(fullStake, loserBefore);
    if (lastResult.cardsTransferred !== expectedTransfer) {
      throw new Error(
        `Transferred ${lastResult.cardsTransferred} cards, expected ${expectedTransfer} (bid ${lastResult.bid}, tier×mult ${fullStake}, loser had ${loserBefore})`
      );
    }
    if (lastResult.redoubled && !lastResult.doubled) {
      throw new Error('Redoubled round without a double');
    }
    if (lastResult.baseCardsAfter[0] === 0 || lastResult.baseCardsAfter[1] === 0) {
      kunukkuStats.zeroStrips++;
    }
    if (state.phase === 'round_end') {
      state = startNextRound(state);
    }
  }
  if (state.winner === null) throw new Error('game_end with no winner');
  if (state.baseCards[state.winner] !== state.totalBaseCards) {
    throw new Error(`Winner declared without holding all base cards: ${state.baseCards[state.winner]}`);
  }
  const last = state.history[state.history.length - 1];
  // A match can only end as the breaking blow against a team that entered
  // the round already stripped - so nothing changes hands on the final round.
  if (last.cardsTransferred !== 0) {
    throw new Error(`Match ended on a round that still transferred ${last.cardsTransferred} cards`);
  }
  console.log(
    `Game ${gameIndex} [${difficulty}]: winner=Team ${state.winner} after ${rounds} rounds, base cards ${state.baseCards[0]}-${state.baseCards[1]}, last round bid=${last.bid} made=${last.made}`
  );
}

const GAMES = 200;
const DIFFICULTIES: BotDifficulty[] = ['rookie', 'regular', 'expert'];
for (let i = 1; i <= GAMES; i++) {
  runFullGame(i, DIFFICULTIES[i % DIFFICULTIES.length]);
}
console.log(`\nAll ${GAMES} simulated games completed with valid invariants (mixed bot difficulties).`);
console.log(
  `Kunukku activity across all games: ${kunukkuStats.marked} first clips, ${kunukkuStats.cleared} seats shed clips, ` +
    `${kunukkuStats.doubled} second clips, ${kunukkuStats.blockedWins} blocked-win events, ` +
    `${kunukkuStats.zeroStrips} rounds ending with a team stripped to zero.`
);
console.log(`Stake calls across all games: ${doubleStats.doubles} doubles, ${doubleStats.redoubles} redoubles.`);
