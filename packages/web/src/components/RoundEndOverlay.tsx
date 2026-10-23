import type { Player, RoundResult } from '@twenty-eight/engine';
import { stakeLabel } from '../utils/stakes';
import { BaseCardTally } from './BaseCardTally';

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

  const total = result.baseCardsAfter[0] + result.baseCardsAfter[1];
  // Saves from before breaks existed have no brokenTeam on their results.
  const broken = result.brokenTeam ?? null;
  return (
    <div className="overlay">
      <div className="overlay-card result-card">
        <h2>Round {result.roundNumber} result</h2>
        <div className={`result-banner ${result.made ? 'made' : 'failed'}`}>
          <span className="result-icon" aria-hidden="true">
            {result.made ? '✓' : '✕'}
          </span>
          {result.made ? (result.fullKai ? 'Full kai' : 'Bid made') : 'Bid failed'}
        </div>
        <p>
          <strong>{teamName(result.biddingTeam)}</strong> bid {result.bid} and captured{' '}
          {result.pointsCaptured[result.biddingTeam]} points.
        </p>
        {(!result.made || result.fullKai) && (
          <p className={result.made ? 'result-made' : 'result-failed'}>
            {result.made
              ? 'They swept all 8 kai!'
              : `Needed ${result.bid}, captured only ${result.pointsCaptured[result.biddingTeam]}.`}
          </p>
        )}
        {stakeLabel(result.bid) && <p className="result-stakes">Stakes this round: {stakeLabel(result.bid)}</p>}
        <BaseCardTally baseCards={result.baseCardsAfter} totalBaseCards={total} />
        {broken !== null && (
          <p className="result-break">
            Team {broken === 0 ? 'A' : 'B'} had nothing left to give — Team {broken === 0 ? 'B' : 'A'} breaks them! The
            base cards are shared out again, {total / 2} each, and play goes on. Every kunukku clip stays on.
          </p>
        )}
        {broken === null && (
          <p className="result-transfer">
            Team {result.roundWinnerTeam === 0 ? 'B' : 'A'} hands over {result.cardsTransferred} base card
            {result.cardsTransferred > 1 ? 's' : ''}. Base cards: Team A {result.baseCardsAfter[0]}, Team B{' '}
            {result.baseCardsAfter[1]}.
          </p>
        )}
        {result.cardsTransferred > 0 && result.baseCardsAfter[result.roundWinnerTeam === 0 ? 1 : 0] === 0 && (
          <p className="result-failed">
            Team {result.roundWinnerTeam === 0 ? 'B' : 'A'} is stripped of base cards — kunukku state! They must win a
            round to survive; losing again breaks them.
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
