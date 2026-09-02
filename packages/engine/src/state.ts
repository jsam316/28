// Small helpers shared by the dealing, bidding, play and scoring modules.
import { type GameState, type Player, type Seat, nextSeat } from './types.js';

export function playerName(players: Player[], seat: Seat): string {
  return players.find((p) => p.seat === seat)?.name ?? `Seat ${seat}`;
}

export function partnerOf(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}

export function appendLog(state: GameState, ...lines: string[]): string[] {
  return [...state.log, ...lines];
}

// The seat whose turn it is to play to the current trick.
export function expectedPlaySeat(trick: GameState['trick']): Seat | null {
  if (trick.cards.length === 0) return trick.leadSeat;
  return nextSeat(trick.cards[trick.cards.length - 1].seat);
}
