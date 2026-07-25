import type { Card, KunukkuLevel, Player, Seat } from '@twenty-eight/engine';
import { PlayingCard } from './Card';

interface PlayerSeatProps {
  player: Player;
  isTurn: boolean;
  isDealer: boolean;
  isBidder: boolean;
  cardCount: number;
  kunukku: KunukkuLevel;
  // When set, this seat has a trump card set aside beside it: card === null
  // shows it face-down (concealed); a card shows it face-up (just revealed).
  trumpAside?: { card: Card | null };
  position: 'bottom' | 'left' | 'top' | 'right';
}

export function PlayerSeat({
  player,
  isTurn,
  isDealer,
  isBidder,
  cardCount,
  kunukku,
  trumpAside,
  position,
}: PlayerSeatProps) {
  return (
    <div className={`seat seat-${position} ${isTurn ? 'seat-active' : ''}`}>
      {trumpAside && (
        <div className="seat-trump-aside" title="Trump card set aside">
          {trumpAside.card ? (
            <PlayingCard card={trumpAside.card} size="sm" />
          ) : (
            <div className="card card-back size-sm" aria-label="face-down trump card" />
          )}
        </div>
      )}
      <div className="seat-badges">
        {isDealer && <span className="badge badge-dealer">D</span>}
        {isBidder && <span className="badge badge-bidder">Bid</span>}
        {kunukku > 0 && (
          <span
            className={`badge badge-kunukku ${kunukku === 2 ? 'badge-kunukku-double' : ''}`}
            title={
              kunukku === 2
                ? 'Kunukku (doubled) — must bid 20+ and make it to clear both partners'
                : 'Kunukku — must win the bid and make it to clear'
            }
          >
            Kunukku{kunukku === 2 ? ' ×2' : ''}
          </span>
        )}
      </div>
      <div className="seat-avatar">{player.name.slice(0, 1).toUpperCase()}</div>
      <div className="seat-name">
        {player.name}
        {!player.connected && <span className="seat-disconnected"> (offline)</span>}
      </div>
      <div className="seat-cardcount">{cardCount} cards</div>
      {isTurn && player.isBot && (
        <div className="thinking-indicator" aria-label={`${player.name} is thinking`}>
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

export function seatPosition(seat: Seat, you: Seat): 'bottom' | 'left' | 'top' | 'right' {
  const rel = (seat - you + 4) % 4;
  return (['bottom', 'left', 'top', 'right'] as const)[rel];
}
