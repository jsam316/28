import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  type GameState,
  type Seat,
  canRequestTrumpReveal,
  getLegalCards,
  getPlayerView,
  playCard,
  requestTrumpReveal,
} from '../src/index.js';
import { card, ids, playingState } from './helpers.js';

function play(state: GameState, seat: Seat, c: string): GameState {
  return playCard(state, seat, card(c));
}

// Dealer 3, so seat 0 leads. Seat 0 bid 16 and set aside the 7 of hearts.
function baseState(overrides: Partial<Parameters<typeof playingState>[0]> = {}): GameState {
  return playingState({
    hands: [
      ['JS', '9S', '7H', '8H', 'AD', '10D', '7C', '8C'],
      ['AS', '10S', 'QH', 'KH', '9D', 'JD', 'QC', 'KC'],
      ['KS', 'QS', 'AH', '10H', '7D', '8D', 'JC', '9C'],
      ['8S', '7S', 'JH', '9H', 'QD', 'KD', 'AC', '10C'],
    ],
    bidderSeat: 0,
    bid: 16,
    trumpCard: '7H',
    ...overrides,
  });
}

describe('the concealed trump card', () => {
  it('is held out of the bidder’s playable cards', () => {
    const s = baseState();
    assert.ok(!ids(getLegalCards(s, 0)).includes('7H'));
    assert.throws(() => play(s, 0, '7H'), /Illegal card/);
  });

  it('does not count toward following suit', () => {
    // Seat 1 leads hearts; seat 0 (in a later state) holds only 7H (aside) and 8H.
    let s = baseState({
      hands: [['7H', '8H', 'AD'], ['QH', 'KH', '9D'], ['AH', '10H', '7D'], ['JH', '9H', 'QD']],
      dealerSeat: 0,
    });
    s = play(s, 1, 'QH');
    s = play(s, 2, 'AH');
    s = play(s, 3, 'JH');
    // 8H is still a heart, so seat 0 must follow with it.
    assert.deepEqual(ids(getLegalCards(s, 0)), ['8H']);
  });

  it('lets the bidder discard freely when only the aside card matches the led suit', () => {
    let s = baseState({
      hands: [['7H', 'AD', '10D'], ['QH', 'KH', '9D'], ['AH', '10H', '7D'], ['JH', '9H', 'QD']],
      dealerSeat: 0,
    });
    s = play(s, 1, 'QH');
    s = play(s, 2, 'AH');
    s = play(s, 3, 'JH');
    assert.deepEqual(ids(getLegalCards(s, 0)), ['AD', '10D']);
    assert.equal(canRequestTrumpReveal(s, 0), true, 'the bidder counts as void and may call');
  });

  it('is force-exposed when it is the bidder’s last card', () => {
    let s = baseState({
      hands: [['7H'], ['QH'], ['AH'], ['JH']],
      dealerSeat: 0,
    });
    s = play(s, 1, 'QH');
    s = play(s, 2, 'AH');
    s = play(s, 3, 'JH');
    assert.deepEqual(ids(getLegalCards(s, 0)), ['7H']);
    s = play(s, 0, '7H');
    assert.equal(s.trump.revealed, true);
    assert.ok(s.log.some((l) => /forced to expose/.test(l)));
    // It was exposed as it was played, so it counts as a trump and wins the kai.
    assert.equal(s.completedTricks[0].winnerSeat, 0);
  });
});

describe('calling for the trump', () => {
  it('is only possible when void in the led suit and not leading', () => {
    let s = baseState();
    assert.equal(canRequestTrumpReveal(s, 0), false, 'cannot call when leading');
    assert.throws(() => requestTrumpReveal(s, 0), /when leading/);
    s = play(s, 0, 'AD');
    assert.equal(canRequestTrumpReveal(s, 1), false, 'seat 1 holds diamonds');
    assert.throws(() => requestTrumpReveal(s, 1), /must be void/);
  });

  it('is a choice, never an obligation, for a void player', () => {
    let s = baseState({
      hands: [['AD', '10D', '7H'], ['8D', 'QC', 'KC'], ['7D', 'AH', 'KS'], ['QD', 'KD', '8S']],
      dealerSeat: 3,
    });
    s = play(s, 0, 'AD');
    s = play(s, 1, '8D');
    s = play(s, 2, '7D');
    s = play(s, 3, 'QD');
    s = play(s, 0, '10D');
    assert.equal(canRequestTrumpReveal(s, 1), true);
    // Seat 1 may simply discard instead of calling.
    s = play(s, 1, 'QC');
    assert.equal(s.trump.revealed, false);
    assert.equal(s.mustTrumpSeat, null);
  });

  it('restricts the caller to trumps for that kai only', () => {
    let s = baseState({
      hands: [['AD', '10D', '7H', 'JS'], ['8D', 'QC', 'KC', 'AS'], ['7D', 'AH', 'JH', 'KS'], ['QD', 'KD', '8S', '7S']],
      dealerSeat: 3,
    });
    // Seat 0 leads a spade so seat 3 can't call; make seat 2 void instead on a club lead.
    s = play(s, 0, 'JS');
    s = play(s, 1, 'AS');
    s = play(s, 2, 'KS');
    s = play(s, 3, '8S');
    assert.equal(s.trick.leadSeat, 0);
    s = play(s, 0, 'AD');
    s = play(s, 1, '8D');
    s = play(s, 2, '7D');
    s = play(s, 3, 'QD');
    // Seat 0 leads 10D; seat 1 is void in diamonds and calls.
    s = play(s, 0, '10D');
    assert.equal(canRequestTrumpReveal(s, 1), true);
    s = requestTrumpReveal(s, 1);
    assert.equal(s.trump.revealed, true);
    assert.equal(s.mustTrumpSeat, 1);
    assert.throws(() => requestTrumpReveal(s, 1), /already revealed/);
    // Seat 1 holds no hearts, so anything goes for the caller.
    assert.deepEqual(ids(getLegalCards(s, 1)), ['QC', 'KC']);
    s = play(s, 1, 'QC');
    assert.equal(s.mustTrumpSeat, null);
    // Seat 2 holds AH and JH: void in diamonds, trumping is optional.
    assert.deepEqual(ids(getLegalCards(s, 2)), ['AH', 'JH']);
  });

  it('forces the caller to play a trump when holding one', () => {
    let s = baseState({
      hands: [['AD', '10D', '7H'], ['8D', 'QH', 'KC'], ['7D', 'AH', 'KS'], ['QD', 'KD', '8S']],
      dealerSeat: 3,
    });
    s = play(s, 0, 'AD');
    s = play(s, 1, '8D');
    s = play(s, 2, '7D');
    s = play(s, 3, 'QD');
    s = play(s, 0, '10D');
    s = requestTrumpReveal(s, 1);
    assert.deepEqual(ids(getLegalCards(s, 1)), ['QH']);
    assert.throws(() => play(s, 1, 'KC'), /must play a trump/);
    s = play(s, 1, 'QH');
    s = play(s, 2, 'AH');
    s = play(s, 3, 'KD');
    assert.equal(s.completedTricks[1].winnerSeat, 2, 'AH is the highest post-reveal trump');
  });
});

describe('trick resolution during play', () => {
  it('does not let a trump-suit card played before the reveal win', () => {
    let s = baseState({
      hands: [['AD', '10D', '7H'], ['8D', 'QH', 'KC'], ['AH', 'JH', 'KS'], ['QD', 'KD', '8S']],
      dealerSeat: 3,
    });
    s = play(s, 0, 'AD');
    s = play(s, 1, '8D');
    // Seat 2 is void and dumps the ace of trumps WITHOUT calling.
    s = play(s, 2, 'AH');
    s = play(s, 3, 'QD');
    assert.equal(s.completedTricks[0].winnerSeat, 0, 'AD wins: hearts were not yet trumps');
    assert.equal(s.trump.revealed, false);
  });

  it('gives the lead to the kai winner', () => {
    let s = baseState();
    s = play(s, 0, 'AD');
    s = play(s, 1, 'JD');
    s = play(s, 2, '7D');
    s = play(s, 3, 'QD');
    assert.equal(s.trick.leadSeat, 1);
    assert.equal(s.trick.trickNumber, 2);
    assert.equal(s.completedTricks[0].points, 4);
  });

  it('rejects out-of-turn plays and cards not in hand', () => {
    const s = baseState();
    assert.throws(() => play(s, 1, 'AS'), /Not your turn/);
    assert.throws(() => play(s, 0, 'AS'), /not in hand/);
  });
});

describe('early end', () => {
  it('ends the round as soon as the defenders lock the bid out', () => {
    // Bid 24: the defenders need more than 4 points to make it impossible.
    let s = baseState({ bid: 24 });
    s = play(s, 0, 'AD'); // 1
    s = play(s, 1, 'JD'); // 3 -> seat 1 wins 4 points... need > 4
    s = play(s, 2, '7D');
    s = play(s, 3, 'QD');
    assert.equal(s.phase, 'playing', '4 points is not yet a lockout against 24');
    s = play(s, 1, 'AS'); // seat 1 leads; 1 point
    s = play(s, 2, 'KS');
    s = play(s, 3, '8S');
    s = play(s, 0, 'JS'); // seat 0 wins with JS: seat 0 is the bidder, so no lockout
    assert.equal(s.phase, 'playing');
    s = play(s, 0, '10D'); // 1
    s = play(s, 1, '9D'); // 2 -> seat 1 wins 3 -> defenders 7 > 4
    s = play(s, 2, '8D');
    s = play(s, 3, 'KD');
    assert.equal(s.phase, 'round_end');
    assert.equal(s.completedTricks.length, 3);
    const r = s.history[0];
    assert.equal(r.made, false);
    assert.equal(r.bid, 24);
    assert.ok(s.log.some((l) => /round ends early/.test(l)));
  });

  it('plays a made bid through all eight kai', () => {
    let s = baseState({ bid: 14 });
    let guard = 0;
    while (s.phase === 'playing' && guard++ < 40) {
      const seat = s.trick.cards.length === 0 ? (s.trick.leadSeat as Seat) : (((s.trick.cards[3 - (4 - s.trick.cards.length)].seat + 1) % 4) as Seat);
      const legal = getLegalCards(s, seat);
      s = playCard(s, seat, legal[0]);
    }
    assert.ok(s.phase === 'round_end' || s.phase === 'game_end');
    assert.equal(s.completedTricks.length, 8);
    assert.equal(s.completedTricks.reduce((sum, t) => sum + t.points, 0), 28);
  });
});

describe('player views', () => {
  it('hides the set-aside card from everyone but the chooser until revealed', () => {
    const s = baseState();
    assert.equal(getPlayerView(s, 0).trump.card?.rank, '7');
    assert.equal(getPlayerView(s, 1).trump.card, null);
    assert.equal(getPlayerView(s, 1).trump.suit, null);
    assert.equal(getPlayerView(s, 1).trump.concealedForYou, true);
    const revealed = { ...s, trump: { ...s.trump, revealed: true } };
    assert.equal(getPlayerView(revealed, 1).trump.suit, 'H');
  });

  it('only lists legal cards for the seat whose turn it is', () => {
    const s = baseState();
    assert.equal(getPlayerView(s, 0).legalCards.length, 7);
    assert.equal(getPlayerView(s, 1).legalCards.length, 0);
  });
});
