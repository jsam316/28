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

// Play never stops on its own, so a match is a fixed stretch of rounds.
const ROUNDS_PER_MATCH = 40;

// Team 0 (seats 0 and 2) plays with difficulty a, team 1 with difficulty b.
// Returns the rounds each team won, the teams each broke, and points taken.
function playMatch(
  a: BotDifficulty,
  b: BotDifficulty,
  seed: number
): { roundsWon: [number, number]; breaks: [number, number]; points: [number, number] } {
  const rng = mulberry32(seed);
  let s: GameState = createGame(makePlayers(), { baseCardsPerTeam: 3, rng });
  const points: [number, number] = [0, 0];
  const roundsWon: [number, number] = [0, 0];
  const breaks: [number, number] = [0, 0];
  for (let rounds = 0; rounds < ROUNDS_PER_MATCH; rounds++) {
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
    roundsWon[r.roundWinnerTeam]++;
    if (r.brokenTeam !== null) breaks[r.roundWinnerTeam]++;
    s = startNextRound(s, { rng });
  }
  return { roundsWon, breaks, points };
}

function pairing(a: BotDifficulty, b: BotDifficulty, matches: number) {
  let roundsA = 0;
  let breaksA = 0;
  let breaksB = 0;
  let pointsA = 0;
  let pointsTotal = 0;
  for (let i = 0; i < matches; i++) {
    // Alternate which side sits in seat 0 so neither gets the first deal every time.
    const swap = i % 2 === 1;
    const result = swap ? playMatch(b, a, i + 1) : playMatch(a, b, i + 1);
    const ia = swap ? 1 : 0;
    roundsA += result.roundsWon[ia];
    breaksA += result.breaks[ia];
    breaksB += result.breaks[1 - ia];
    pointsA += result.points[ia];
    pointsTotal += result.points[0] + result.points[1];
  }
  const share = roundsA / (matches * ROUNDS_PER_MATCH);
  console.log(
    `${a} vs ${b}: ${a} won ${(100 * share).toFixed(1)}% of rounds, took ${((100 * pointsA) / pointsTotal).toFixed(1)}% of points, broke ${breaksA} times and was broken ${breaksB} times over ${matches} matches of ${ROUNDS_PER_MATCH} rounds`
  );
  return share;
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
