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
import { card, cards, id, mulberry32, playingState, seededGame, trickWonBy } from './helpers.js';

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

describe('bot play heuristics', () => {
  // Dealer 3, so seat 0 leads. Seat 1 bid 16 and set aside the 7 of hearts.
  function table(hands: [string[], string[], string[], string[]], revealed = false): GameState {
    return playingState({ hands, bidderSeat: 1, bid: 16, trumpCard: '7H', revealed });
  }
  function playFor(s: GameState, seat: Seat, difficulty: BotDifficulty): string {
    const action = decideBotAction(getPlayerView(s, seat), difficulty);
    assert.equal(action.type, 'play');
    return action.type === 'play' ? id(action.card) : '';
  }

  it('feeds points to a partner who is winning when last to play', () => {
    let s = table([['JS', '7D', '8D'], ['8S', 'QD', 'KD'], ['9S', '10S', '7C'], ['QS', '9D', '8C']]);
    s = playCard(s, 0, card('JS'));
    s = playCard(s, 1, card('8S'));
    // Seat 2's partner (seat 0) holds the kai with the Jack and seat 3 has
    // followed, so the 9 (2 points) is a safe gift; a cheap bot would keep it.
    assert.equal(playFor(s, 2, 'regular'), '9S');
    assert.equal(playFor(s, 2, 'expert'), '9S');
  });

  it('keeps cheap when the partner is not safe yet', () => {
    let s = table([['AS', '7D', '8D'], ['8S', 'QD', 'KD'], ['9S', '10S', '7C'], ['JS', '9D', '8C']]);
    s = playCard(s, 0, card('AS'));
    s = playCard(s, 1, card('8S'));
    // Seat 3 still to play could hold the Jack: a regular bot follows with its cheapest spade.
    assert.equal(playFor(s, 2, 'regular'), '10S');
  });

  it('cashes a boss card when leading with the cards tracked', () => {
    // All the higher spades are gone: seat 0 leads and its 10S is boss.
    let s = table([['10S', '7D'], ['8S', 'QD'], ['9D', '7C'], ['KD', '8C']]);
    s = {
      ...s,
      completedTricks: [
        trickWonBy(0, 3 + 2 + 1, 1),
        { ...trickWonBy(0, 0, 2), cards: cards('JS', '9S', 'AS', 'KS').map((c, i) => ({ seat: i as Seat, card: c })) },
      ],
      trick: { leadSeat: 0, cards: [], trickNumber: 3 },
    };
    assert.equal(playFor(s, 0, 'expert'), '10S');
  });
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
