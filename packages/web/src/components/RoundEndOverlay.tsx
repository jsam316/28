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
        {(result.stakeMultiplier > 1 || result.bid >= 20) && (
          <p className="result-failed">
            Raised stakes this round:
            {result.bid >= 24 ? ' 24+ bid ×4' : result.bid >= 20 ? ' 20+ bid ×2' : ''}
            {result.doubled ? (result.redoubled ? ' · REDOUBLED ×4' : ' · DOUBLED ×2') : ''}
          </p>
        )}
        <p>
          {result.cardsTransferred > 0 ? (
            <>
              Team {result.roundWinnerTeam === 0 ? 'B' : 'A'} hands over {result.cardsTransferred} base card
              {result.cardsTransferred > 1 ? 's' : ''}. Base cards: Team A {result.baseCardsAfter[0]}, Team B{' '}
              {result.baseCardsAfter[1]}.
            </>
          ) : (
            <>No base cards left to hand over.</>
          )}
        </p>
        {result.cardsTransferred > 0 && result.baseCardsAfter[result.roundWinnerTeam === 0 ? 1 : 0] === 0 && (
          <p className="result-failed">
            Team {result.roundWinnerTeam === 0 ? 'B' : 'A'} is stripped of base cards — kunukku state! They must win a
            round to survive; losing again means the match.
          </p>
        )}
        {result.kunukkuMarked.length > 0 && (
          <p className="result-failed">
            {result.kunukkuMarked.map(playerName).join(' & ')} {result.kunukkuMarked.length > 1 ? 'wear' : 'wears'} the
            kunukku clip!
          </p>
        )}
        {result.kunukkuCleared.length > 0 && (
          <p className="result-made">
            {result.kunukkuCleared.map(playerName).join(' & ')} {result.kunukkuCleared.length > 1 ? 'shed' : 'sheds'}{' '}
            kunukku clips!
          </p>
        )}
        {result.kunukkuDoubled.length > 0 && (
          <p className="result-failed">
            {result.kunukkuDoubled.map(playerName).join(' & ')} {result.kunukkuDoubled.length > 1 ? 'take' : 'takes'} a
            second kunukku clip!
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
