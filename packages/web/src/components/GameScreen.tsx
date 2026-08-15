import { useEffect, useState } from 'react';
import { bidTierStake, getCurrentActorSeat, type Card, type PlayerView, type Seat } from '@twenty-eight/engine';
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
  redeal: () => void;
  callTrump: () => void;
  play: (card: Card) => void;
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

  // When the trump is called, flash the actual card beside the bidder's seat
  // for a beat before it "returns to their hand" and disappears from the table.
  const [revealedAsideCard, setRevealedAsideCard] = useState<Card | null>(null);
  useEffect(() => {
    if (view.trump.revealed && view.trump.card) {
      setRevealedAsideCard(view.trump.card);
      const timer = setTimeout(() => setRevealedAsideCard(null), 2200);
      return () => clearTimeout(timer);
    }
    setRevealedAsideCard(null);
  }, [view.trump.revealed, view.trump.card]);

  const trumpHolder = view.trump.chosenBySeat;
  const trumpAsideFor = (seat: Seat): { card: Card | null } | undefined => {
    if (trumpHolder !== seat) return undefined;
    if (!view.trump.revealed) return { card: null }; // concealed: face-down beside the seat
    if (revealedAsideCard) return { card: revealedAsideCard }; // just revealed: flash it, then gone
    return undefined;
  };
  const asideConcealedFor = (seat: Seat) => trumpHolder === seat && !view.trump.revealed;

  // The bidder's set-aside trump is held out of their playable hand while
  // concealed, so hide it from their own hand display too (it shows beside the
  // seat instead) until the trump is revealed and it returns to hand.
  const concealedTrumpId =
    trumpHolder === you && !view.trump.revealed && view.trump.card
      ? `${view.trump.card.rank}${view.trump.card.suit}`
      : null;
  const displayHand = concealedTrumpId
    ? view.hand.filter((c) => `${c.rank}${c.suit}` !== concealedTrumpId)
    : view.hand;

  const handPreview = (
    <div className="hand">
      {displayHand.map((c) => (
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
        stakeMultiplier={view.bidding.currentBid !== null ? bidTierStake(view.bidding.currentBid) : 1}
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
            cardCount={view.handCounts[p.seat] - (asideConcealedFor(p.seat) ? 1 : 0)}
            kunukku={view.kunukku[p.seat]}
            trumpAside={trumpAsideFor(p.seat)}
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
              canDemandRedeal={view.canDemandRedeal}
              onBid={actions.bid}
              onRedeal={actions.redeal}
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

        {view.phase === 'playing' && (
          <>
            {view.canRequestTrumpReveal && (
              <button type="button" className="btn btn-call-trump" onClick={actions.callTrump}>
                Call for trump
              </button>
            )}
            <Hand
              cards={displayHand}
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
