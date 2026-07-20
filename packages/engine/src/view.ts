import { canRequestTrumpReveal, getLegalCards } from './engine.js';
import type { GameState, PlayerView, Seat } from './types.js';

export function getPlayerView(state: GameState, seat: Seat): PlayerView {
  const handCounts = [0, 1, 2, 3].map((s) => state.hands[s as Seat].length) as [
    number,
    number,
    number,
    number
  ];

  const isChooser = state.trump.chosenBySeat === seat;
  const trumpSuit = state.trump.revealed || isChooser ? state.trump.suit : null;

  return {
    you: seat,
    players: state.players,
    dealerSeat: state.dealerSeat,
    phase: state.phase,
    hand: state.hands[seat],
    handCounts,
    secondBatchDealt: state.secondBatchDealt,
    bidding: state.bidding,
    trump: {
      suit: trumpSuit,
      concealedForYou: !state.trump.revealed && !isChooser && state.trump.suit !== null,
      chosenBySeat: state.trump.chosenBySeat,
      revealed: state.trump.revealed,
    },
    trick: state.trick,
    completedTricks: state.completedTricks,
    baseCards: state.baseCards,
    totalBaseCards: state.totalBaseCards,
    roundNumber: state.roundNumber,
    history: state.history,
    log: state.log,
    winner: state.winner,
    canRequestTrumpReveal: canRequestTrumpReveal(state, seat),
    legalCards: getLegalCards(state, seat),
    kunukku: state.kunukku,
  };
}
