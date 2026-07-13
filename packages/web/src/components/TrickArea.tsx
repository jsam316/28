import type { PlayedCard, Seat } from '@twenty-eight/engine';
import { PlayingCard } from './Card';
import { seatPosition } from './PlayerSeat';

interface TrickAreaProps {
  cards: PlayedCard[];
  you: Seat;
  trickNumber: number;
}

export function TrickArea({ cards, you, trickNumber }: TrickAreaProps) {
  return (
    <div className="trick-area">
      <div className="trick-number">Trick {trickNumber}/8</div>
      {cards.map((pc) => {
        const pos = seatPosition(pc.seat, you);
        return (
          <div key={pc.seat} className={`trick-card trick-card-${pos}`}>
            <PlayingCard card={pc.card} size="sm" />
          </div>
        );
      })}
    </div>
  );
}
