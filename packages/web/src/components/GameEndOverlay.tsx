import type { Player, RoundResult } from '@twenty-eight/engine';

interface GameEndOverlayProps {
  winner: 0 | 1;
  baseCards: [number, number];
  totalBaseCards: number;
  lastResult?: RoundResult;
  players: Player[];
  onRestart?: () => void;
}

export function GameEndOverlay({ winner, baseCards, totalBaseCards, lastResult, players, onRestart }: GameEndOverlayProps) {
  const teamName = (team: 0 | 1) =>
    team === 0
      ? players.filter((p) => p.seat % 2 === 0).map((p) => p.name).join(' & ')
      : players.filter((p) => p.seat % 2 === 1).map((p) => p.name).join(' & ');

  const playerName = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Seat ${seat}`;

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2>Team {winner === 0 ? 'A' : 'B'} wins the match!</h2>
        {lastResult && (
          <>
            <p>
              Final round: <strong>{teamName(lastResult.biddingTeam)}</strong> bid {lastResult.bid} and captured{' '}
              {lastResult.pointsCaptured[lastResult.biddingTeam]} points.
            </p>
            <p className={lastResult.made ? 'result-made' : 'result-failed'}>
              {lastResult.made
                ? lastResult.kappu
                  ? 'KAPPU! They swept all 8 kai — double points!'
                  : 'Bid made!'
                : `Bid failed — needed ${lastResult.bid}, captured only ${lastResult.pointsCaptured[lastResult.biddingTeam]}.`}
            </p>
            {lastResult.kunukkuCleared.length > 0 && (
              <p className="result-made">{lastResult.kunukkuCleared.map(playerName).join(' & ')} cleared their kunukku!</p>
            )}
          </>
        )}
        <p>
          They collected all {totalBaseCards} base cards (Team A {baseCards[0]} — Team B {baseCards[1]}).
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
