import { useEffect, useRef, useState } from 'react';
import type { CompletedTrick, PlayedCard, Seat } from '@twenty-eight/engine';
import { PlayingCard } from './Card';
import { seatPosition } from './PlayerSeat';

interface TrickAreaProps {
  cards: PlayedCard[];
  you: Seat;
  completedTricks: CompletedTrick[];
}

// The winning (4th) card lands on the table and every card rests here before
// the whole kai sweeps to the winner. Without the rest beat the 4th card
// would mount already carrying the sweep transform and never be seen.
const REST_MS = 650;
const SWEEP_MS = 650;
export const TRICK_ANIM_TOTAL_MS = REST_MS + SWEEP_MS;

export function TrickArea({ cards, you, completedTricks }: TrickAreaProps) {
  const [completed, setCompleted] = useState<CompletedTrick | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const seenCount = useRef(completedTricks.length);

  useEffect(() => {
    if (completedTricks.length > seenCount.current) {
      seenCount.current = completedTricks.length;
      const justCompleted = completedTricks[completedTricks.length - 1];
      // Show all four cards at rest first, then flip on the sweep so they
      // transition (rather than mounting) toward the winner.
      setCompleted(justCompleted);
      setSweeping(false);
      const sweepTimer = setTimeout(() => setSweeping(true), REST_MS);
      const clearTimer = setTimeout(() => {
        setCompleted(null);
        setSweeping(false);
      }, TRICK_ANIM_TOTAL_MS);
      return () => {
        clearTimeout(sweepTimer);
        clearTimeout(clearTimer);
      };
    }
    seenCount.current = completedTricks.length;
  }, [completedTricks]);

  // Once the next card of the following kai is played, drop back to live cards.
  const showingCompleted = completed !== null && cards.length === 0;
  const shown = showingCompleted ? completed!.cards : cards;
  const isSweeping = showingCompleted && sweeping;
  const winnerPos = showingCompleted ? seatPosition(completed!.winnerSeat, you) : null;

  return (
    <div className="trick-area">
      {shown.map((pc) => {
        const pos = seatPosition(pc.seat, you);
        return (
          <div
            key={pc.seat}
            className={`trick-card trick-card-${pos} ${isSweeping ? `trick-card-sweep-${winnerPos}` : ''}`}
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
