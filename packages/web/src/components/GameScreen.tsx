import { useEffect, useState } from 'react';
import { getCurrentActorSeat, nextSeat, type Card, type PlayerView, type Seat } from '@twenty-eight/engine';
import { PlayerSeat, seatPosition } from './PlayerSeat';
import { TrickArea, TRICK_ANIM_TOTAL_MS } from './TrickArea';
import { Hand } from './Hand';
import { PlayingCard } from './Card';
import { BiddingPanel } from './BiddingPanel';
import { TrumpPanel } from './TrumpPanel';
import { Scoreboard } from './Scoreboard';
import { Ticker } from './Ticker';
import { TrumpBanner } from './TrumpBanner';
import { RoundEndOverlay } from './RoundEndOverlay';
import { GameEndOverlay } from './GameEndOverlay';

export interface GameScreenActions {
  bid: (value: 'pass' | number) => void;
  pickTrump: (card: Card) => void;
  callTrump: () => void;
  play: (card: Card) => void;
  double: (accept: boolean) => void;
  redouble: (accept: boolean) => void;
  nextRound?: () => void;
  restart?: () => void;
}

interface GameScreenProps {
  view: PlayerView;
  actions: GameScreenActions;
  waitingForHostMessage?: string;
  onExit?: () => void;
  exitLabel?: string;
}

// Hold the table long enough for the final kai to rest and sweep before the
// round-end overlay appears (plus a small beat to read the winner).
const ROUND_END_REVEAL_DELAY_MS = TRICK_ANIM_TOTAL_MS + 250;

export function GameScreen({ view, actions, waitingForHostMessage, onExit, exitLabel = 'Home' }: GameScreenProps) {
  const { you, players } = view;

  const currentTurnSeat = getCurrentActorSeat(view);

  const lastResult = view.history[view.history.length - 1];

  // The last trick of a round completes and the round ends in the same
  // state update, so without a beat here the final card played (and its
  // sweep-to-winner animation) never gets a chance to render before the
  // round-end overlay covers the table.
  const [revealOverlay, setRevealOverlay] = useState(false);
  useEffect(() => {
    if (view.phase === 'round_end' || view.phase === 'game_end') {
      const timer = setTimeout(() => setRevealOverlay(true), ROUND_END_REVEAL_DELAY_MS);
      return () => clearTimeout(timer);
    }
    setRevealOverlay(false);
  }, [view.phase]);

  const showTable = view.phase === 'playing' || ((view.phase === 'round_end' || view.phase === 'game_end') && !revealOverlay);

  const handPreview = (
    <div className="hand">
      {view.hand.map((c) => (
        <PlayingCard key={`${c.rank}${c.suit}`} card={c} size="lg" />
      ))}
    </div>
  );

  return (
    <div className="game-screen">
      {onExit && (
        <button type="button" className="btn-link exit-link" onClick={onExit}>
          &larr; {exitLabel}
        </button>
      )}

      <Scoreboard
        baseCards={view.baseCards}
        totalBaseCards={view.totalBaseCards}
        stakeMultiplier={view.stakeMultiplier}
        roundNumber={view.roundNumber}
        trumpSuit={view.trump.suit}
        trumpConcealed={view.trump.concealedForYou}
        history={view.history}
      />

      <Ticker log={view.log} />

      {view.phase === 'playing' && view.trump.suit && (
        <TrumpBanner suit={view.trump.suit} card={view.trump.card} revealed={view.trump.revealed} />
      )}

      <div className="table">
        {players.map((p) => (
          <PlayerSeat
            key={p.seat}
            player={p}
            isTurn={currentTurnSeat === p.seat}
            isDealer={view.dealerSeat === p.seat}
            isBidder={view.bidding.currentBidderSeat === p.seat && view.phase !== 'bidding'}
            cardCount={view.handCounts[p.seat]}
            kunukku={view.kunukku[p.seat]}
            position={seatPosition(p.seat, you)}
          />
        ))}

        {showTable && (
          <TrickArea
            cards={view.phase === 'playing' ? view.trick.cards : []}
            you={you}
            completedTricks={view.completedTricks}
          />
        )}
      </div>

      <div className="bottom-panel">
        {view.phase === 'bidding' && (
          <>
            <BiddingPanel
              bidding={view.bidding}
              you={you}
              players={players}
              secondBatchDealt={view.secondBatchDealt}
              onBid={actions.bid}
            />
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

        {view.phase === 'doubling' &&
          (you === nextSeat(view.bidding.currentBidderSeat as Seat) ? (
            <>
              <div className="stake-panel">
                <div className="stake-prompt">
                  {players.find((p) => p.seat === view.bidding.currentBidderSeat)?.name} holds the bid at{' '}
                  {view.bidding.currentBid}. Double the stakes?
                </div>
                <div className="stake-actions">
                  <button type="button" className="btn btn-danger" onClick={() => actions.double(true)}>
                    Double! (2 base cards)
                  </button>
                  <button type="button" className="btn btn-pass" onClick={() => actions.double(false)}>
                    Play on (1 base card)
                  </button>
                </div>
              </div>
              {handPreview}
            </>
          ) : (
            <>
              <div className="waiting-banner">
                Waiting for {players.find((p) => p.seat === nextSeat(view.bidding.currentBidderSeat as Seat))?.name} to
                consider a double...
              </div>
              {handPreview}
            </>
          ))}

        {view.phase === 'redoubling' &&
          (you === view.bidding.currentBidderSeat ? (
            <>
              <div className="stake-panel">
                <div className="stake-prompt">They doubled the stakes! Answer with a redouble?</div>
                <div className="stake-actions">
                  <button type="button" className="btn btn-danger" onClick={() => actions.redouble(true)}>
                    Redouble! (4 base cards)
                  </button>
                  <button type="button" className="btn btn-pass" onClick={() => actions.redouble(false)}>
                    Accept (2 base cards)
                  </button>
                </div>
              </div>
              {handPreview}
            </>
          ) : (
            <>
              <div className="waiting-banner">
                Doubled! Waiting for {players.find((p) => p.seat === view.bidding.currentBidderSeat)?.name} to consider
                a redouble...
              </div>
              {handPreview}
            </>
          ))}

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

      {revealOverlay && view.phase === 'round_end' && lastResult && (
        <RoundEndOverlay
          result={lastResult}
          players={players}
          onContinue={actions.nextRound}
          waitingMessage={actions.nextRound ? undefined : waitingForHostMessage}
        />
      )}

      {revealOverlay && view.phase === 'game_end' && view.winner !== null && (
        <GameEndOverlay
          winner={view.winner}
          baseCards={view.baseCards}
          totalBaseCards={view.totalBaseCards}
          lastResult={lastResult}
          players={players}
          onRestart={actions.restart}
        />
      )}
    </div>
  );
}
