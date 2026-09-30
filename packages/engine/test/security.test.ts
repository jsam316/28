import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  type Card,
  type GameState,
  chooseTrump,
  getPlayerView,
  placeBid,
  playCard,
  requestTrumpReveal,
  secureRandom,
  shuffle,
  startNextRound,
} from '../src/index.js';
import { card, id, playingState, seededGame } from './helpers.js';

// Defences against a hostile client: every engine entry point must reject
// junk, act only on the caller's turn, and never echo client-supplied objects
// or private cards to the table.

describe('secure dealing', () => {
  it('draws uniform floats in [0, 1) from the crypto generator', () => {
    let min = 1;
    let max = 0;
    for (let i = 0; i < 5000; i++) {
      const x = secureRandom();
      assert.ok(x >= 0 && x < 1);
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
    assert.ok(min < 0.01 && max > 0.99, 'covers the range');
  });

  it('shuffles with it by default', () => {
    const deck = Array.from({ length: 32 }, (_, i) => i);
    const a = shuffle(deck);
    const b = shuffle(deck);
    assert.deepEqual([...a].sort((x, y) => x - y), deck, 'a permutation');
    assert.notDeepEqual(a, b, 'two default shuffles differ');
  });
});

describe('bid validation', () => {
  for (const junk of ['15', 'NaN', 14.5, Number.NaN, Infinity, null, {}, [15]]) {
    it(`rejects ${JSON.stringify(junk) ?? String(junk)}`, () => {
      const s = seededGame(5);
      assert.throws(() => placeBid(s, 1, junk as unknown as number), /whole number|at least|exceed/);
    });
  }
});

describe('turn and phase guards', () => {
  // Dealer 3, seat 0 leads; seat 1 is the declarer with the 7 of hearts aside.
  function table(): GameState {
    return playingState({
      hands: [['AD', '7C'], ['7H', 'QC', 'KC'], ['9C', 'KS'], ['KD', 'AS']],
      bidderSeat: 1,
      bid: 16,
      trumpCard: '7H',
    });
  }

  it('refuses a trump call out of turn, even from a void player', () => {
    let s = table();
    s = playCard(s, 0, card('AD'));
    // Seat 2 holds no diamonds but it is seat 1's turn.
    assert.throws(() => requestTrumpReveal(s, 2), /on your turn/);
    assert.equal(s.trump.revealed, false);
  });

  it('refuses to deal a new round while one is in play', () => {
    const s = table();
    assert.throws(() => startNextRound(s), /not over/);
  });

  it('refuses to continue a finished match', () => {
    const s: GameState = { ...table(), phase: 'game_end', winner: 0 };
    assert.throws(() => startNextRound(s), /not over/);
  });
});

describe('client objects are never echoed', () => {
  it('stores the hand’s own card when a trump is set aside', () => {
    const s = placeBid(seededGame(5), 1, 14);
    const mine = s.hands[1][0];
    const hostile = { ...mine, note: 'x'.repeat(10_000) } as Card & { note: string };
    const after = chooseTrump(s, 1, hostile);
    assert.equal(after.trump.card, mine, 'the hand object, not the caller’s');
    assert.ok(!('note' in (after.trump.card as object)));
  });

  it('plays the hand’s own card to the table', () => {
    const s = playingState({
      hands: [['AD', '7C'], ['7H', 'QC', 'KC'], ['9C', 'KS'], ['KD', 'AS']],
      bidderSeat: 1,
      bid: 16,
      trumpCard: '7H',
    });
    const hostile = { ...card('AD'), extra: '<script>' } as Card & { extra: string };
    const after = playCard(s, 0, hostile);
    const onTable = after.trick.cards[0].card;
    assert.equal(id(onTable), 'AD');
    assert.ok(!('extra' in (onTable as object)));
  });
});

describe('private cards stay private', () => {
  it('does not name the old set-aside card when the bid changes hands', () => {
    let s = placeBid(seededGame(7), 1, 14);
    const firstAside = s.hands[1][0];
    s = chooseTrump(s, 1, firstAside);
    s = placeBid(s, 2, 15);
    const everyone = getPlayerView(s, 3).log.join(' ');
    assert.ok(/takes over the bid/.test(everyone));
    assert.ok(!everyone.includes(id(firstAside)), 'the card itself is never named');
  });

  it('shows the concealed trump only to its chooser', () => {
    let s = placeBid(seededGame(7), 1, 14);
    s = chooseTrump(s, 1, s.hands[1][0]);
    for (const seat of [0, 2, 3] as const) {
      const v = getPlayerView(s, seat);
      assert.equal(v.trump.card, null);
      assert.equal(v.trump.suit, null);
      assert.ok(!JSON.stringify(v).includes(`"hands"`), 'no other hands in the view');
    }
    assert.ok(getPlayerView(s, 1).trump.card);
  });
});
