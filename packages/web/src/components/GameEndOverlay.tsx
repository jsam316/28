interface GameEndOverlayProps {
  winner: 0 | 1;
  scores: [number, number];
  onRestart?: () => void;
}

export function GameEndOverlay({ winner, scores, onRestart }: GameEndOverlayProps) {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2>Team {winner === 0 ? 'A' : 'B'} wins the match!</h2>
        <p>
          Final score: Team A {scores[0]} — Team B {scores[1]}
        </p>
        {onRestart && (
          <button type="button" className="btn btn-primary" onClick={onRestart}>
            Play again
          </button>
        )}
      </div>
    </div>
  );
}
