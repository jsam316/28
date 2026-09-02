import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  type GameState,
  type Seat,
  canDemandRedeal,
  chooseTrump,
  demandRedeal,
  getCurrentActorSeat,
  placeBid,
} from '../src/index.js';
import { card, cards, id, seededGame } from './helpers.js';

// Bid for the current actor and immediately set aside their lowest card as
// trump, returning the state with the auction resumed.
function bidAndPlace(state: GameState, seat: Seat, bid: number): GameState {
  const afterBid = placeBid(state, seat, bid);
  assert.equal(afterBid.phase, 'trump_selection');
  return chooseTrump(afterBid, seat, afterBid.hands[seat][0]);
}

function withHands(state: GameState, hands: string[][]): GameState {
  return { ...state, hands: hands.map((h) => cards(...h)) as GameState['hands'] };
}

describe('round one bidding', () => {
  it('starts with the player left of the dealer', () => {
    const s = seededGame(7);
    assert.equal(s.dealerSeat, 0);
    assert.equal(getCurrentActorSeat(s), 1);
    assert.equal(s.hands[1].length, 4);
    assert.equal(s.stock[1].length, 4);
  });

  it('does not let the opener pass', () => {
    const s = seededGame(7);
    assert.throws(() => placeBid(s, 1, 'pass'), /must bid at least 14/);
  });

  it('rejects bids below the minimum and out of turn', () => {
    const s = seededGame(7);
    assert.throws(() => placeBid(s, 1, 13), /at least 14/);
    assert.throws(() => placeBid(s, 2, 14), /Not your turn/);
  });

  it('has no cap on a round-one bid short of 28', () => {
    const s = seededGame(7);
    const after = placeBid(s, 1, 28);
    assert.equal(after.bidding.currentBid, 28);
    assert.throws(() => placeBid(s, 1, 29), /cannot exceed 28/);
  });

  it('pauses the auction for the bidder to set a trump aside', () => {
    const s = placeBid(seededGame(7), 1, 14);
    assert.equal(s.phase, 'trump_selection');
    assert.equal(getCurrentActorSeat(s), 1);
    assert.throws(() => chooseTrump(s, 2, s.hands[2][0]), /Only the current high bidder/);
    assert.throws(() => chooseTrump(s, 1, s.hands[2][0]), /one of your own cards/);
    const placed = chooseTrump(s, 1, s.hands[1][2]);
    assert.equal(placed.phase, 'bidding');
    assert.equal(id(placed.trump.card!), id(s.hands[1][2]));
    assert.equal(placed.trump.chosenBySeat, 1);
    assert.equal(placed.trump.revealed, false);
    assert.equal(getCurrentActorSeat(placed), 2);
  });

  it('requires at least 20 to raise over a partner', () => {
    let s = bidAndPlace(seededGame(7), 1, 15);
    s = placeBid(s, 2, 'pass');
    assert.throws(() => placeBid(s, 3, 16), /at least 20/);
    const raised = placeBid(s, 3, 20);
    assert.equal(raised.bidding.currentBid, 20);
  });

  it('lets an opponent raise by just one', () => {
    const s = bidAndPlace(seededGame(7), 1, 15);
    const raised = placeBid(s, 2, 16);
    assert.equal(raised.bidding.currentBidderSeat, 2);
  });

  it('re-places the trump when a new leader takes the bid', () => {
    let s = bidAndPlace(seededGame(7), 1, 14);
    const firstTrump = s.trump.card!;
    s = bidAndPlace(s, 2, 15);
    assert.equal(s.trump.chosenBySeat, 2);
    assert.notEqual(id(s.trump.card!), id(firstTrump));
    assert.ok(s.hands[1].some((c) => id(c) === id(firstTrump)), 'earlier trump stays in the old leader hand');
  });
});

describe('round two bidding', () => {
  function closeRoundOne(seed = 7): GameState {
    let s = bidAndPlace(seededGame(seed), 1, 14);
    s = placeBid(s, 2, 'pass');
    s = placeBid(s, 3, 'pass');
    s = placeBid(s, 0, 'pass');
    return s;
  }

  it('deals the second batch and reopens bidding to everyone from 24', () => {
    const s = closeRoundOne();
    assert.equal(s.phase, 'bidding');
    assert.equal(s.secondBatchDealt, true);
    for (const seat of [0, 1, 2, 3] as Seat[]) assert.equal(s.hands[seat].length, 8);
    assert.equal(getCurrentActorSeat(s), 1);
    assert.deepEqual(s.bidding.passed, [false, false, false, false]);
    assert.equal(s.bidding.currentBid, 14, 'the round-one bid still stands');
    assert.throws(() => placeBid(s, 1, 23), /at least 24/);
  });

  it('lets the round-one bidder let the bid stand', () => {
    let s = closeRoundOne();
    s = placeBid(s, 1, 'pass');
    s = placeBid(s, 2, 'pass');
    s = placeBid(s, 3, 'pass');
    s = placeBid(s, 0, 'pass');
    assert.equal(s.phase, 'playing');
    assert.equal(s.bidding.currentBidderSeat, 1);
    assert.equal(s.bidding.currentBid, 14);
    assert.equal(s.trick.leadSeat, 1);
  });

  it('lets any seat take the bid over at 24+ and re-place the trump', () => {
    let s = closeRoundOne();
    s = placeBid(s, 1, 'pass');
    s = bidAndPlace(s, 2, 24);
    assert.equal(s.trump.chosenBySeat, 2);
    s = placeBid(s, 3, 'pass');
    s = placeBid(s, 0, 'pass');
    assert.equal(s.phase, 'playing');
    assert.equal(s.bidding.currentBidderSeat, 2);
    assert.equal(s.bidding.currentBid, 24);
  });

  it('closes the auction the moment someone bids 28', () => {
    let s = closeRoundOne();
    s = bidAndPlace(s, 1, 28);
    assert.equal(s.phase, 'playing', 'nobody can outbid 28, so the auction closes');
    assert.equal(s.bidding.currentBidderSeat, 1);
  });

  it('gives every seat a say even when the standing bidder holds first', () => {
    let s = closeRoundOne();
    s = placeBid(s, 1, 'pass'); // the round-one bidder holds
    s = placeBid(s, 2, 'pass');
    s = placeBid(s, 3, 'pass');
    assert.equal(s.phase, 'bidding', 'seat 0 has not spoken yet');
    assert.equal(getCurrentActorSeat(s), 0);
    s = bidAndPlace(s, 0, 25);
    assert.equal(s.phase, 'playing');
    assert.equal(s.bidding.currentBidderSeat, 0);
    assert.equal(s.bidding.currentBid, 25);
  });

  it('does not ask the standing bidder to outbid themselves', () => {
    let s = closeRoundOne();
    s = placeBid(s, 1, 'pass');
    s = bidAndPlace(s, 2, 24);
    s = placeBid(s, 3, 'pass');
    s = placeBid(s, 0, 'pass');
    assert.equal(s.phase, 'playing', 'seat 1 already passed this round; the auction is over');
  });
});

describe('redeals', () => {
  it('only the opener may throw in a pointless first four cards, before any action', () => {
    const base = seededGame(7);
    const s = withHands(base, [['7S', '8S', 'QS', 'KS'], ['7H', '8H', 'QH', 'KH'], ['JS', '9S', 'AS', '10S'], ['JH', '9H', 'AH', '10H']]);
    assert.equal(canDemandRedeal(s, 1), true);
    assert.equal(canDemandRedeal(s, 0), false, 'seat 0 is not the opener');
    assert.throws(() => demandRedeal(s, 0), /cannot demand a redeal/);
    const afterBid = placeBid(s, 1, 14);
    assert.equal(canDemandRedeal(afterBid, 1), false);
  });

  it('is not offered when the opener holds any point card', () => {
    const s = withHands(seededGame(7), [['7S', '8S', 'QS', 'KS'], ['7H', '8H', 'QH', '10H'], ['JS', '9S', 'AS', '10S'], ['JH', '9H', 'AH', 'KH']]);
    assert.equal(canDemandRedeal(s, 1), false);
  });

  it('redeals with the same dealer and round number and a fresh deal', () => {
    const base = seededGame(7);
    const s = withHands(base, [['7S', '8S', 'QS', 'KS'], ['7H', '8H', 'QH', 'KH'], ['JS', '9S', 'AS', '10S'], ['JH', '9H', 'AH', '10H']]);
    const again = demandRedeal(s, 1);
    assert.equal(again.dealerSeat, s.dealerSeat);
    assert.equal(again.roundNumber, s.roundNumber);
    assert.equal(again.phase, 'bidding');
    assert.equal(again.bidding.history.length, 0);
    assert.ok(again.log.some((l) => /demands a redeal/.test(l)));
  });

  it('redeals automatically when a full hand holds all four Jacks', () => {
    let s = seededGame(7);
    // Force seat 2's second batch to be the four Jacks.
    s = {
      ...s,
      hands: [cards('7S', '8S', 'QS', 'AS'), cards('7H', '8H', 'QH', '10H'), cards('KS', '9S', '10S', 'AH'), cards('KH', '9H', '7D', '8D')],
      stock: [cards('QD', 'KD', '10D', 'AD'), cards('9D', '7C', '8C', 'QC'), cards('JS', 'JH', 'JD', 'JC'), cards('KC', '10C', 'AC', '9C')],
    };
    s = placeBid(s, 1, 14);
    s = chooseTrump(s, 1, card('10H'));
    s = placeBid(s, 2, 'pass');
    s = placeBid(s, 3, 'pass');
    s = placeBid(s, 0, 'pass');
    assert.equal(s.secondBatchDealt, false, 'the hand was thrown in');
    assert.equal(s.phase, 'bidding');
    assert.ok(s.log.some((l) => /four Jacks/.test(l)));
    assert.equal(s.trump.card, null);
  });
});
