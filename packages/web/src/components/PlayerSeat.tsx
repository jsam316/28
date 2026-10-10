import type { Card, KunukkuLevel, Player } from '@twenty-eight/engine';
import { PlayingCard } from './Card';
import type { TablePosition } from '../utils/seats';

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
  position: TablePosition;
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
  const team = player.seat % 2;
  return (
    <div className={`seat seat-${position} team-${team} ${isTurn ? 'seat-active' : ''}`}>
      {trumpAside && (
        <div className="seat-trump-aside" title="Trump card set aside">
          {trumpAside.card ? (
            <PlayingCard card={trumpAside.card} size="sm" />
          ) : (
            <div className="card card-back size-sm" aria-label="face-down trump card" />
          )}
        </div>
      )}
      <div className="seat-avatar-wrap">
        <div className="seat-avatar" aria-hidden="true">
          {player.name.slice(0, 1).toUpperCase()}
        </div>
        {isDealer && (
          <span className="badge badge-dealer" title="Dealer">
            D
          </span>
        )}
      </div>
      <div className="seat-plate">
        <div className="seat-name">
          {player.name}
          {!player.connected && <span className="seat-disconnected"> (offline)</span>}
        </div>
        <div className="seat-meta">
          <span className="seat-cardcount">
            <span className="mini-back" aria-hidden="true" />
            {cardCount} cards
          </span>
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
      </div>
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
