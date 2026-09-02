import { dealSecondBatch, redealRound } from './dealing.js';
import { minNextBid } from './rules.js';
import { appendLog, playerName } from './state.js';
import { type BiddingState, type Card, type GameState, type Seat, cardId, nextSeat, teamOf } from './types.js';

export function isRaisingOverPartner(bidding: BiddingState, seat: Seat): boolean {
  return (
    bidding.currentBidderSeat !== null &&
    bidding.currentBidderSeat !== seat &&
    teamOf(bidding.currentBidderSeat) === teamOf(seat)
  );
}

export function placeBid(state: GameState, seat: Seat, action: 'pass' | number): GameState {
  if (state.phase !== 'bidding') throw new Error('Not in bidding phase');
  if (state.bidding.turnSeat !== seat) throw new Error('Not your turn to bid');
  if (state.bidding.passed[seat]) throw new Error('You already passed');

  const bidding = structuredClone(state.bidding);

  if (action === 'pass') {
    // The opener may not pass: they must open at the minimum bid (their only
    // alternative is the pointless-hand redeal, handled separately).
    if (!state.secondBatchDealt && bidding.history.length === 0) {
      throw new Error(`The opening bidder must bid at least ${bidding.minBid}`);
    }
    bidding.passed[seat] = true;
    bidding.history.push({ seat, action });
    return advanceBidding({ ...state, bidding }, [`${playerName(state.players, seat)} passes.`]);
  }

  const raisingOverPartner = isRaisingOverPartner(bidding, seat);
  const minAllowed = minNextBid(bidding.currentBid, bidding.minBid, state.secondBatchDealt, raisingOverPartner);
  if (action < minAllowed) {
    throw new Error(
      raisingOverPartner && action <= bidding.maxBid
        ? `Raising over your partner requires a bid of at least ${minAllowed}`
        : `Bid must be at least ${minAllowed}`
    );
  }
  if (action > bidding.maxBid) throw new Error(`Bid cannot exceed ${bidding.maxBid}`);
  bidding.currentBid = action;
  bidding.currentBidderSeat = seat;
  bidding.history.push({ seat, action });

  // Every leading bid is followed by that bidder setting aside a trump card
  // before the auction moves on; any trump the previous leader set aside simply
  // reverts to an ordinary card in their hand.
  return {
    ...state,
    bidding,
    phase: 'trump_selection',
    log: appendLog(state, `${playerName(state.players, seat)} bids ${action}.`),
  };
}

// Resume the auction after an action (a pass, or a leading bid's trump
// placement): advance to the next active seat, or close the round out.
function advanceBidding(state: GameState, log: string[]): GameState {
  const bidding = structuredClone(state.bidding);
  // The opener is obliged to bid, so by the time anyone can pass a bid always
  // stands - a round can never close without a bidder. The auction is over
  // once every seat other than the standing bidder has passed (in round two
  // the bidder "holds" by passing, which must not shut out the seats still to
  // speak), or as soon as the bid hits the ceiling nobody can raise.
  const stillToSpeak = ([0, 1, 2, 3] as Seat[]).filter(
    (s) => !bidding.passed[s] && s !== bidding.currentBidderSeat
  );
  const closed = stillToSpeak.length === 0 || bidding.currentBid === bidding.maxBid;
  if (closed) {
    log.push(
      `Bidding closed. ${playerName(state.players, bidding.currentBidderSeat as Seat)} holds the bid at ${bidding.currentBid}.`
    );
    return concludeBidding({ ...state, bidding }, log);
  }

  let next = nextSeat(bidding.turnSeat);
  while (bidding.passed[next] || next === bidding.currentBidderSeat) next = nextSeat(next);
  bidding.turnSeat = next;
  return { ...state, bidding, phase: 'bidding', log: appendLog(state, ...log) };
}

// A bidding round is over. Round one deals the rest of the hand and opens the
// 24+ round; round two moves straight into play - stakes are set automatically
// by the bid tier, with no separate doubling step.
function concludeBidding(state: GameState, log: string[]): GameState {
  if (!state.secondBatchDealt) {
    const { hands, stock } = dealSecondBatch(state);

    // If any player's eight-card hand holds all four Jacks, they must show
    // them and the whole hand is redealt by the same dealer.
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const jacks = hands[seat].filter((c) => c.rank === 'J').length;
      if (jacks === 4) {
        return redealRound(
          { ...state, hands, stock, log: appendLog(state, ...log) },
          `${playerName(state.players, seat)} shows all four Jacks — the hand is redealt.`
        );
      }
    }

    const reopened: BiddingState = {
      ...state.bidding,
      passed: [false, false, false, false],
      turnSeat: nextSeat(state.dealerSeat),
    };
    log.push(
      `The rest of the hand is dealt. ${playerName(state.players, reopened.turnSeat)} opens the second bidding round (24+).`
    );
    return { ...state, hands, stock, secondBatchDealt: true, bidding: reopened, phase: 'bidding', log: appendLog(state, ...log) };
  }

  log.push('Play begins.');
  return beginPlay(state, log);
}

function beginPlay(state: GameState, log: string[]): GameState {
  const leadSeat = nextSeat(state.dealerSeat);
  return {
    ...state,
    phase: 'playing',
    trick: { leadSeat, cards: [], trickNumber: 1 },
    log: appendLog(state, ...log),
  };
}

export function chooseTrump(state: GameState, seat: Seat, card: Card): GameState {
  if (state.phase !== 'trump_selection') throw new Error('Not in trump selection phase');
  if (state.bidding.currentBidderSeat !== seat) throw new Error('Only the current high bidder chooses trump');
  if (!state.hands[seat].some((c) => cardId(c) === cardId(card))) {
    throw new Error('Trump card must be one of your own cards');
  }

  // Set (or replace) the trump this bidder sets aside, then resume the auction.
  const trump = { suit: card.suit, card, chosenBySeat: seat, revealed: false };
  return advanceBidding({ ...state, trump }, [`${playerName(state.players, seat)} sets a trump card aside (concealed).`]);
}
