// Pit two bot difficulties against each other over many matches and report
// the win rate, so a change to the bot AI can be shown to actually help.
//
//   npm run bench -w packages/engine            # expert vs regular, regular vs rookie
//   npm run bench -w packages/engine -- 500     # more matches per pairing
import {
  type BotDifficulty,
  type GameState,
  type Player,
  type Seat,
  chooseTrump,
  createGame,
  decideBotAction,
  demandRedeal,
  getCurrentActorSeat,
  getPlayerView,
  placeBid,
  playCard,
  requestTrumpReveal,
  startNextRound,
} from './index.js';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePlayers(): Player[] {
  return ([0, 1, 2, 3] as Seat[]).map((seat) => ({
    id: `bot${seat}`,
    name: `Bot ${seat}`,
    seat,
    isBot: true,
    connected: true,
  }));
}

// Team 0 (seats 0 and 2) plays with difficulty a, team 1 with difficulty b.
function playMatch(a: BotDifficulty, b: BotDifficulty, seed: number): { winner: 0 | 1; rounds: number; points: [number, number] } {
  const rng = mulberry32(seed);
  let s: GameState = createGame(makePlayers(), { baseCardsPerTeam: 3, rng });
  const points: [number, number] = [0, 0];
  let rounds = 0;
  while (s.phase !== 'game_end') {
    if (++rounds > 500) throw new Error('match did not converge');
    let guard = 0;
    while (s.phase === 'bidding' || s.phase === 'trump_selection' || s.phase === 'playing') {
      if (++guard > 400) throw new Error('round stuck');
      const seat = getCurrentActorSeat(s) as Seat;
      const action = decideBotAction(getPlayerView(s, seat), seat % 2 === 0 ? a : b);
      if (action.type === 'redeal') s = demandRedeal(s, seat, { rng });
      else if (action.type === 'bid') s = placeBid(s, seat, action.value);
      else if (action.type === 'trump') s = chooseTrump(s, seat, action.card);
      else if (action.type === 'reveal') s = requestTrumpReveal(s, seat);
      else s = playCard(s, seat, action.card);
    }
    const r = s.history[s.history.length - 1];
    points[0] += r.pointsCaptured[0];
    points[1] += r.pointsCaptured[1];
    if (s.phase === 'round_end') s = startNextRound(s, { rng });
  }
  return { winner: s.winner as 0 | 1, rounds, points };
}

function pairing(a: BotDifficulty, b: BotDifficulty, matches: number) {
  let winsA = 0;
  let totalRounds = 0;
  let pointsA = 0;
  let pointsTotal = 0;
  for (let i = 0; i < matches; i++) {
    // Alternate which side sits in seat 0 so neither gets the first deal every time.
    const swap = i % 2 === 1;
    const result = swap ? playMatch(b, a, i + 1) : playMatch(a, b, i + 1);
    const aWon = swap ? result.winner === 1 : result.winner === 0;
    if (aWon) winsA++;
    totalRounds += result.rounds;
    pointsA += swap ? result.points[1] : result.points[0];
    pointsTotal += result.points[0] + result.points[1];
  }
  const pct = ((100 * winsA) / matches).toFixed(1);
  const share = ((100 * pointsA) / pointsTotal).toFixed(1);
  console.log(
    `${a} vs ${b}: ${a} won ${winsA}/${matches} matches (${pct}%), took ${share}% of points, ${(totalRounds / matches).toFixed(1)} rounds per match`
  );
  return winsA / matches;
}

const matches = Number(process.argv[2] ?? 300);
const expertEdge = pairing('expert', 'regular', matches);
pairing('regular', 'rookie', matches);
pairing('expert', 'rookie', matches);

// Fail loudly if the "expert" bots are not actually better than "regular".
if (expertEdge < 0.5) {
  console.error('Expert bots did not beat regular bots - the AI change is a regression.');
  process.exit(1);
}
