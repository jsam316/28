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

  const playerName = (seat: number) => players.find((p) => p.seat === seat)?.name ?? `Seat ${seat}`;

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
            : `Bid failed — needed ${result.bid}, captured only ${result.pointsCaptured[result.biddingTeam]}.`}
        </p>
        <p>
          {result.cardsTransferred > 0 ? (
            <>
              Team {result.roundWinnerTeam === 0 ? 'B' : 'A'} hands over a base card. Base cards: Team A{' '}
              {result.baseCardsAfter[0]}, Team B {result.baseCardsAfter[1]}.
            </>
          ) : (
            <>No base cards left to hand over.</>
          )}
        </p>
        {result.kunukkuMarked.length > 0 && (
          <p className="result-failed">
            Shut out! {result.kunukkuMarked.map(playerName).join(' & ')} {result.kunukkuMarked.length > 1 ? 'are' : 'is'}{' '}
            marked with a kunukku.
          </p>
        )}
        {result.kunukkuCleared.length > 0 && (
          <p className="result-made">{result.kunukkuCleared.map(playerName).join(' & ')} cleared their kunukku!</p>
        )}
        {result.kunukkuDoubled.length > 0 && (
          <p className="result-failed">
            {result.kunukkuDoubled.map(playerName).join(' & ')} failed to clear the kunukku — it doubled!
          </p>
        )}
        {result.kunukkuBlockedWinner !== null && (
          <p className="result-failed">
            Team {result.kunukkuBlockedWinner === 0 ? 'A' : 'B'} reached the target score but must clear their kunukku
            before winning — the match continues!
          </p>
        )}
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
