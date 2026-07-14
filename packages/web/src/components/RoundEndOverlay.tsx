import type { Player, RoundResult } from '@twenty-eight/engine';

interface RoundEndOverlayProps {
  result: RoundResult;
  players: Player[];
  onContinue?: () => void;
  waitingMessage?: string;
}

export function RoundEndOverlay({ result, players, onContinue, waitingMessage }: RoundEndOverlayProps) {
  const teamName = (team: 0 | 1) =>
    team === 0
      ? players.filter((p) => p.seat % 2 === 0).map((p) => p.name).join(' & ')
      : players.filter((p) => p.seat % 2 === 1).map((p) => p.name).join(' & ');

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2>Round {result.roundNumber} result</h2>
        <p>
          <strong>{teamName(result.biddingTeam)}</strong> bid {result.bid} and captured{' '}
          {result.pointsCaptured[result.biddingTeam]} points.
        </p>
        <p className={result.made ? 'result-made' : 'result-failed'}>
          {result.made
            ? result.kappu
              ? 'KAPPU! They swept all 8 kai — double points!'
              : 'Bid made!'
            : 'Bid failed — the bid was set.'}
        </p>
        <p>
          Score change: Team A {result.scoreDelta[0] > 0 ? `+${result.scoreDelta[0]}` : 0}, Team B{' '}
          {result.scoreDelta[1] > 0 ? `+${result.scoreDelta[1]}` : 0}
        </p>
        {onContinue && (
          <button type="button" className="btn btn-primary" onClick={onContinue}>
            Next round
          </button>
        )}
        {waitingMessage && <p className="waiting-message">{waitingMessage}</p>}
      </div>
    </div>
  );
}
