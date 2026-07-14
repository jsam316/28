import { useEffect, useRef, useState } from 'react';
import type { CompletedTrick, PlayedCard, Seat } from '@twenty-eight/engine';
import { PlayingCard } from './Card';
import { seatPosition } from './PlayerSeat';

interface TrickAreaProps {
  cards: PlayedCard[];
  you: Seat;
  completedTricks: CompletedTrick[];
}

const SWEEP_MS = 650;

export function TrickArea({ cards, you, completedTricks }: TrickAreaProps) {
  const [sweep, setSweep] = useState<CompletedTrick | null>(null);
  const seenCount = useRef(completedTricks.length);

  useEffect(() => {
    if (completedTricks.length > seenCount.current) {
      const justCompleted = completedTricks[completedTricks.length - 1];
      setSweep(justCompleted);
      const timer = setTimeout(() => setSweep(null), SWEEP_MS);
      seenCount.current = completedTricks.length;
      return () => clearTimeout(timer);
    }
    seenCount.current = completedTricks.length;
  }, [completedTricks]);

  const sweeping = sweep && cards.length === 0;
  const shown = sweeping ? sweep!.cards : cards;
  const winnerPos = sweeping ? seatPosition(sweep!.winnerSeat, you) : null;

  return (
    <div className="trick-area">
      {shown.map((pc) => {
        const pos = seatPosition(pc.seat, you);
        return (
          <div
            key={pc.seat}
            className={`trick-card trick-card-${pos} ${sweeping ? `trick-card-sweep-${winnerPos}` : ''}`}
          >
            <div className="trick-card-anim">
              <PlayingCard card={pc.card} size="sm" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
