import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTNER_OVERCALL_MIN_BID,
  SECOND_ROUND_MIN_BID,
  type PlayedCard,
  type Seat,
  bidTierStake,
  cardStrength,
  legalCardsFor,
  minNextBid,
  resolveTrick,
} from '../src/index.js';
import { card, cards, ids } from './helpers.js';

function played(list: string[], afterReveal: boolean[] = []): PlayedCard[] {
  return list.map((c, i) => ({ seat: i as Seat, card: card(c), playedAfterReveal: afterReveal[i] ?? false }));
}

describe('card strength', () => {
  it('ranks J > 9 > A > 10 > K > Q > 8 > 7', () => {
    const order = cards('JS', '9S', 'AS', '10S', 'KS', 'QS', '8S', '7S');
    for (let i = 1; i < order.length; i++) {
      assert.ok(cardStrength(order[i - 1]) > cardStrength(order[i]), `${ids([order[i - 1]])} > ${ids([order[i]])}`);
    }
  });
});

describe('minNextBid', () => {
  it('opens round one at the table minimum', () => {
    assert.equal(minNextBid(null, 14, false), 14);
  });
  it('raises by one over a standing bid in round one', () => {
    assert.equal(minNextBid(17, 14, false), 18);
  });
  it('requires 20 to raise over a partner', () => {
    assert.equal(minNextBid(15, 14, false, true), PARTNER_OVERCALL_MIN_BID);
    assert.equal(minNextBid(22, 14, false, true), 23);
  });
  it('opens round two at 24 whatever the standing bid', () => {
    assert.equal(minNextBid(null, 14, true), SECOND_ROUND_MIN_BID);
    assert.equal(minNextBid(16, 14, true), SECOND_ROUND_MIN_BID);
    assert.equal(minNextBid(25, 14, true), 26);
  });
});

describe('bidTierStake', () => {
  it('stakes one card below 20, two from 20 and four from 24', () => {
    assert.equal(bidTierStake(14), 1);
    assert.equal(bidTierStake(19), 1);
    assert.equal(bidTierStake(20), 2);
    assert.equal(bidTierStake(23), 2);
    assert.equal(bidTierStake(24), 4);
    assert.equal(bidTierStake(28), 4);
  });
});

describe('legalCardsFor', () => {
  it('forces following suit when possible', () => {
    const hand = cards('JS', '7H', '9H');
    assert.deepEqual(ids(legalCardsFor(hand, 'H')), ['7H', '9H']);
  });
  it('frees the whole hand when void or leading', () => {
    const hand = cards('JS', '7H');
    assert.deepEqual(ids(legalCardsFor(hand, 'D')), ['JS', '7H']);
    assert.deepEqual(ids(legalCardsFor(hand, null)), ['JS', '7H']);
  });
});

describe('resolveTrick', () => {
  it('awards the kai to the strongest card of the led suit with no trump', () => {
    const t = resolveTrick(played(['10S', 'JH', '9S', 'AS']), null, 1);
    assert.equal(t.winnerSeat, 2);
    assert.equal(t.points, 1 + 3 + 2 + 1);
  });
  it('lets a revealed trump beat the led suit', () => {
    const t = resolveTrick(played(['JS', '7H', '9S', 'AS'], [false, true, false, false]), 'H', 1);
    assert.equal(t.winnerSeat, 1);
  });
  it('ignores a trump-suit card that hit the table before the reveal', () => {
    // Seat 1 dumped the ace of hearts before anyone called; seat 3's queen of
    // hearts played after the call is the only real trump.
    const t = resolveTrick(played(['JS', 'AH', '9S', 'QH'], [false, false, false, true]), 'H', 1);
    assert.equal(t.winnerSeat, 3);
  });
  it('compares only post-reveal trumps against each other', () => {
    const t = resolveTrick(played(['7S', 'JH', '9H', '8H'], [false, false, true, true]), 'H', 1);
    assert.equal(t.winnerSeat, 2);
  });
});
