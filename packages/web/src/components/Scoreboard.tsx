import type { RoundResult } from '@twenty-eight/engine';

interface ScoreboardProps {
  baseCards: [number, number];
  totalBaseCards: number;
  roundNumber: number;
  trumpSuit: string | null;
  trumpConcealed: boolean;
  history: RoundResult[];
}

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function Scoreboard({
  baseCards,
  totalBaseCards,
  roundNumber,
  trumpSuit,
  trumpConcealed,
  history,
}: ScoreboardProps) {
  const totalPoints = history.reduce<[number, number]>(
    (acc, r) => [acc[0] + r.pointsCaptured[0], acc[1] + r.pointsCaptured[1]],
    [0, 0]
  );

  return (
    <div className="scoreboard">
      <div className="score-team score-a">
        Team A: <span className="base-chip" aria-hidden="true" />
        {baseCards[0]}
        <span className="score-points"> · {totalPoints[0]} pts</span>
      </div>
      <div className="score-round">
        Round {roundNumber} · collect all {totalBaseCards}
      </div>
      <div className="trump-indicator">
        Trump:{' '}
        {trumpSuit ? (
          <span className={trumpSuit === 'H' || trumpSuit === 'D' ? 'red' : 'black'}>{SUIT_SYMBOL[trumpSuit]}</span>
        ) : trumpConcealed ? (
          <span className="trump-hidden">hidden</span>
        ) : (
          <span className="trump-hidden">—</span>
        )}
      </div>
      <div className="score-team score-b">
        Team B: <span className="base-chip" aria-hidden="true" />
        {baseCards[1]}
        <span className="score-points"> · {totalPoints[1]} pts</span>
      </div>
    </div>
  );
}
