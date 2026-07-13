import { getCurrentActorSeat, type Card, type PlayerView, type Suit } from '@twenty-eight/engine';
import { PlayerSeat, seatPosition } from './PlayerSeat';
import { TrickArea } from './TrickArea';
import { Hand } from './Hand';
import { PlayingCard } from './Card';
import { BiddingPanel } from './BiddingPanel';
import { TrumpPanel } from './TrumpPanel';
import { Scoreboard } from './Scoreboard';
import { LogPanel } from './LogPanel';
import { RoundEndOverlay } from './RoundEndOverlay';
import { GameEndOverlay } from './GameEndOverlay';

export interface GameScreenActions {
  bid: (value: 'pass' | number) => void;
  pickTrump: (suit: Suit) => void;
  callTrump: () => void;
  play: (card: Card) => void;
  nextRound?: () => void;
  restart?: () => void;
}

interface GameScreenProps {
  view: PlayerView;
  actions: GameScreenActions;
  waitingForHostMessage?: string;
}

export function GameScreen({ view, actions, waitingForHostMessage }: GameScreenProps) {
  const { you, players } = view;

  const currentTurnSeat = getCurrentActorSeat(view);

  const lastResult = view.history[view.history.length - 1];

  const handPreview = (
    <div className="hand">
      {view.hand.map((c) => (
        <PlayingCard key={`${c.rank}${c.suit}`} card={c} size="lg" />
      ))}
    </div>
  );

  return (
    <div className="game-screen">
      <Scoreboard
        scores={view.scores}
        targetScore={view.targetScore}
        roundNumber={view.roundNumber}
        trumpSuit={view.trump.suit}
        trumpConcealed={view.trump.concealedForYou}
      />

      <div className="table">
        {players.map((p) => (
          <PlayerSeat
            key={p.seat}
            player={p}
            isTurn={currentTurnSeat === p.seat}
            isDealer={view.dealerSeat === p.seat}
            isBidder={view.bidding.currentBidderSeat === p.seat && view.phase !== 'bidding'}
            cardCount={view.handCounts[p.seat]}
            position={seatPosition(p.seat, you)}
          />
        ))}

        {view.phase === 'playing' && (
          <TrickArea cards={view.trick.cards} you={you} trickNumber={view.trick.trickNumber} />
        )}
      </div>

      <LogPanel log={view.log} />

      <div className="bottom-panel">
        {view.phase === 'bidding' && (
          <>
            <BiddingPanel bidding={view.bidding} you={you} players={players} onBid={actions.bid} />
            {handPreview}
          </>
        )}

        {view.phase === 'trump_selection' && view.bidding.currentBidderSeat === you && (
          <TrumpPanel hand={view.hand} bidAmount={view.bidding.currentBid ?? 0} onChoose={actions.pickTrump} />
        )}
        {view.phase === 'trump_selection' && view.bidding.currentBidderSeat !== you && (
          <>
            <div className="waiting-banner">
              Waiting for {players.find((p) => p.seat === view.bidding.currentBidderSeat)?.name} to pick trump...
            </div>
            {handPreview}
          </>
        )}

        {view.phase === 'playing' && (
          <>
            {view.canRequestTrumpReveal && view.trump.suit === null && (
              <button type="button" className="btn btn-call-trump" onClick={actions.callTrump}>
                Call for trump
              </button>
            )}
            <Hand
              cards={view.hand}
              legalCards={view.legalCards}
              canPlay={currentTurnSeat === you}
              onPlay={actions.play}
            />
          </>
        )}
      </div>

      {view.phase === 'round_end' && lastResult && (
        <RoundEndOverlay
          result={lastResult}
          players={players}
          onContinue={actions.nextRound}
          waitingMessage={actions.nextRound ? undefined : waitingForHostMessage}
        />
      )}

      {view.phase === 'game_end' && view.winner !== null && (
        <GameEndOverlay winner={view.winner} scores={view.scores} onRestart={actions.restart} />
      )}
    </div>
  );
}
