import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { type GameState, type Seat, finishRound } from '../src/index.js';
import { playingState, trickWonBy } from './helpers.js';

interface RoundSpec {
  bidderSeat: Seat;
  bid: number;
  bidderPoints: number; // points the bidding team captures (rest go to defenders)
  baseCards?: [number, number];
  kunukku?: GameState['kunukku'];
  kappu?: boolean;
}

function settle(spec: RoundSpec): GameState {
  const base = playingState({
    hands: [[], [], [], []],
    bidderSeat: spec.bidderSeat,
    bid: spec.bid,
    trumpCard: '7H',
    baseCards: spec.baseCards,
    kunukku: spec.kunukku,
  });
  const defender = ((spec.bidderSeat + 1) % 4) as Seat;
  const tricks = spec.kappu
    ? Array.from({ length: 8 }, (_, i) => trickWonBy(spec.bidderSeat, i === 0 ? 28 : 0, i + 1))
    : [trickWonBy(spec.bidderSeat, spec.bidderPoints, 1), trickWonBy(defender, 28 - spec.bidderPoints, 2)];
  return finishRound({ ...base, completedTricks: tricks });
}

describe('bid outcome', () => {
  it('makes the bid at exactly the bid amount', () => {
    const s = settle({ bidderSeat: 0, bid: 16, bidderPoints: 16 });
    assert.equal(s.history[0].made, true);
    assert.equal(s.history[0].roundWinnerTeam, 0);
  });
  it('fails one point short', () => {
    const s = settle({ bidderSeat: 0, bid: 16, bidderPoints: 15 });
    assert.equal(s.history[0].made, false);
    assert.equal(s.history[0].roundWinnerTeam, 1);
  });
  it('flags a kappu when the bidders take every kai', () => {
    const s = settle({ bidderSeat: 1, bid: 20, bidderPoints: 28, kappu: true });
    assert.equal(s.history[0].kappu, true);
  });
});

describe('base-card stakes', () => {
  it('moves one card for a bid under 20', () => {
    const s = settle({ bidderSeat: 0, bid: 19, bidderPoints: 10 });
    assert.equal(s.history[0].cardsTransferred, 1);
    assert.deepEqual(s.baseCards, [5, 7]);
  });
  it('moves two cards for 20-23 and four for 24+', () => {
    assert.deepEqual(settle({ bidderSeat: 0, bid: 20, bidderPoints: 28 }).baseCards, [8, 4]);
    assert.deepEqual(settle({ bidderSeat: 0, bid: 23, bidderPoints: 28 }).baseCards, [8, 4]);
    assert.deepEqual(settle({ bidderSeat: 0, bid: 24, bidderPoints: 28 }).baseCards, [10, 2]);
  });
  it('never moves more than the loser holds', () => {
    const s = settle({ bidderSeat: 0, bid: 24, bidderPoints: 28, baseCards: [10, 2] });
    assert.equal(s.history[0].cardsTransferred, 2);
    assert.deepEqual(s.baseCards, [12, 0]);
    assert.equal(s.phase, 'round_end', 'reaching 12-0 does not end the match by itself');
  });
});

describe('kunukku', () => {
  it('clips both partners when a team is stripped to zero', () => {
    const s = settle({ bidderSeat: 0, bid: 24, bidderPoints: 28, baseCards: [8, 4] });
    assert.deepEqual(s.kunukku, [0, 1, 0, 1]);
    assert.deepEqual(s.history[0].kunukkuMarked, [1, 3]);
  });
  it('does not clip anyone for an ordinary failed bid', () => {
    const s = settle({ bidderSeat: 0, bid: 14, bidderPoints: 5 });
    assert.deepEqual(s.kunukku, [0, 0, 0, 0]);
  });
  it('gives a clipped bidder who fails a second clip', () => {
    const s = settle({ bidderSeat: 2, bid: 15, bidderPoints: 5, kunukku: [1, 0, 1, 0] });
    assert.equal(s.kunukku[2], 2);
    assert.deepEqual(s.history[0].kunukkuDoubled, [2]);
  });
  it('passes the second clip to the partner when both ears are full', () => {
    const s = settle({ bidderSeat: 2, bid: 15, bidderPoints: 5, kunukku: [1, 0, 2, 0] });
    assert.deepEqual(s.kunukku, [2, 0, 2, 0]);
  });
  it('is shed only by the declaring team on a made bid, one per staked card', () => {
    const low = settle({ bidderSeat: 0, bid: 15, bidderPoints: 20, kunukku: [1, 1, 1, 1] });
    assert.deepEqual(low.kunukku, [0, 1, 1, 1], 'a single-card bid frees only the bidder');
    const double = settle({ bidderSeat: 0, bid: 20, bidderPoints: 28, kunukku: [1, 1, 1, 1] });
    assert.deepEqual(double.kunukku, [0, 1, 0, 1], 'a two-card bid frees both partners');
    const defended = settle({ bidderSeat: 1, bid: 20, bidderPoints: 5, kunukku: [1, 1, 1, 1] });
    assert.deepEqual(defended.kunukku, [1, 2, 1, 1], 'defending sheds nothing and the failed bidder sinks');
  });
});

describe('match end', () => {
  it('ends when a team already at zero loses again', () => {
    const s = settle({ bidderSeat: 0, bid: 14, bidderPoints: 20, baseCards: [12, 0] });
    assert.equal(s.phase, 'game_end');
    assert.equal(s.winner, 0);
    assert.equal(s.history[0].cardsTransferred, 0);
  });
  it('lets the stripped team fight back by winning', () => {
    const s = settle({ bidderSeat: 1, bid: 14, bidderPoints: 20, baseCards: [12, 0] });
    assert.equal(s.phase, 'round_end');
    assert.deepEqual(s.baseCards, [11, 1]);
  });
  it('withholds the win from a team still wearing a clip', () => {
    // A single-card bid frees only the bidder's own clip; the partner's stays.
    const s = settle({ bidderSeat: 0, bid: 14, bidderPoints: 20, baseCards: [12, 0], kunukku: [1, 0, 1, 0] });
    assert.deepEqual(s.kunukku, [0, 0, 1, 0]);
    assert.equal(s.phase, 'round_end');
    assert.equal(s.winner, null);
    assert.equal(s.history[0].kunukkuBlockedWinner, 0);
  });
});
