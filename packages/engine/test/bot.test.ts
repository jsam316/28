import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  type BotDifficulty,
  type GameState,
  type Seat,
  cardPoints,
  chooseTrump,
  decideBotAction,
  demandRedeal,
  getCurrentActorSeat,
  getPlayerView,
  placeBid,
  playCard,
  requestTrumpReveal,
  startNextRound,
} from '../src/index.js';
import { cards, id, mulberry32, seededGame } from './helpers.js';

// Drive one round entirely with bots, checking every action was legal (the
// engine throws on anything illegal) and returning the settled state.
function botRound(state: GameState, difficulty: BotDifficulty): GameState {
  let s = state;
  let guard = 0;
  while (s.phase === 'bidding' || s.phase === 'trump_selection' || s.phase === 'playing') {
    if (++guard > 400) throw new Error('bot round did not finish');
    const seat = getCurrentActorSeat(s) as Seat;
    const action = decideBotAction(getPlayerView(s, seat), difficulty);
    switch (action.type) {
      case 'redeal':
        s = demandRedeal(s, seat, { rng: mulberry32(guard) });
        break;
      case 'bid':
        s = placeBid(s, seat, action.value);
        break;
      case 'trump':
        s = chooseTrump(s, seat, action.card);
        break;
      case 'reveal':
        s = requestTrumpReveal(s, seat);
        break;
      case 'play':
        s = playCard(s, seat, action.card);
        break;
    }
  }
  return s;
}

describe('bot legality', () => {
  for (const difficulty of ['rookie', 'regular', 'expert'] as BotDifficulty[]) {
    it(`${difficulty} bots only ever take legal actions across whole matches`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        let s = seededGame(seed, 3);
        let rounds = 0;
        while (s.phase !== 'game_end') {
          if (++rounds > 400) throw new Error('match did not converge');
          s = botRound(s, difficulty);
          if (s.phase === 'round_end') s = startNextRound(s, { rng: mulberry32(seed * 1000 + rounds) });
        }
        assert.notEqual(s.winner, null);
      }
    });
  }
});

describe('bot decisions', () => {
  it('opens at the minimum when forced to bid', () => {
    const s = seededGame(3);
    const action = decideBotAction(getPlayerView(s, 1), 'regular');
    assert.deepEqual(action, { type: 'bid', value: 14 });
  });

  it('throws in a pointless opening hand', () => {
    const s = seededGame(3);
    const pointless = { ...s, hands: [s.hands[0], cards('7S', '8S', 'QS', 'KS'), s.hands[2], s.hands[3]] as GameState['hands'] };
    assert.ok(pointless.hands[1].every((c) => cardPoints(c) === 0));
    assert.deepEqual(decideBotAction(getPlayerView(pointless, 1), 'expert'), { type: 'redeal' });
  });

  it('sets aside a card from its own hand as trump', () => {
    const s = placeBid(seededGame(3), 1, 14);
    const action = decideBotAction(getPlayerView(s, 1), 'expert');
    assert.equal(action.type, 'trump');
    if (action.type === 'trump') {
      assert.ok(s.hands[1].some((c) => id(c) === id(action.card)));
    }
  });
});
