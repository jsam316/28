interface ScoreboardProps {
  scores: [number, number];
  targetScore: number;
  roundNumber: number;
  trumpSuit: string | null;
  trumpConcealed: boolean;
}

const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function Scoreboard({ scores, targetScore, roundNumber, trumpSuit, trumpConcealed }: ScoreboardProps) {
  return (
    <div className="scoreboard">
      <div className="score-team score-a">Team A: {scores[0]}</div>
      <div className="score-round">Round {roundNumber} · first to {targetScore}</div>
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
      <div className="score-team score-b">Team B: {scores[1]}</div>
    </div>
  );
}
