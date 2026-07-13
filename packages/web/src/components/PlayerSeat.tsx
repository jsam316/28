import type { Player, Seat } from '@twenty-eight/engine';

interface PlayerSeatProps {
  player: Player;
  isTurn: boolean;
  isDealer: boolean;
  isBidder: boolean;
  cardCount: number;
  position: 'bottom' | 'left' | 'top' | 'right';
}

export function PlayerSeat({ player, isTurn, isDealer, isBidder, cardCount, position }: PlayerSeatProps) {
  return (
    <div className={`seat seat-${position} ${isTurn ? 'seat-active' : ''}`}>
      <div className="seat-badges">
        {isDealer && <span className="badge badge-dealer">D</span>}
        {isBidder && <span className="badge badge-bidder">Bid</span>}
      </div>
      <div className="seat-avatar">{player.name.slice(0, 1).toUpperCase()}</div>
      <div className="seat-name">
        {player.name}
        {!player.connected && <span className="seat-disconnected"> (offline)</span>}
      </div>
      <div className="seat-cardcount">{cardCount} cards</div>
    </div>
  );
}

export function seatPosition(seat: Seat, you: Seat): 'bottom' | 'left' | 'top' | 'right' {
  const rel = (seat - you + 4) % 4;
  return (['bottom', 'left', 'top', 'right'] as const)[rel];
}
