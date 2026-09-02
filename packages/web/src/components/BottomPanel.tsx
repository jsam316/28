import type { Card, PlayerView, Seat } from '@twenty-eight/engine';
import { BiddingPanel } from './BiddingPanel';
import { TrumpPanel } from './TrumpPanel';
import { Hand } from './Hand';
import { PlayingCard } from './Card';
import type { GameScreenActions } from './GameScreen';

interface BottomPanelProps {
  view: PlayerView;
  displayHand: Card[];
  currentTurnSeat: Seat | null;
  actions: GameScreenActions;
}

// Whatever the viewer can do right now: bid, set a trump aside, call for the
// trump, or play a card - with their hand underneath.
export function BottomPanel({ view, displayHand, currentTurnSeat, actions }: BottomPanelProps) {
  const { you, players } = view;

  const handPreview = (
    <div className="hand" role="group" aria-label="Your hand">
      {displayHand.map((c) => (
        <PlayingCard key={`${c.rank}${c.suit}`} card={c} size="lg" />
      ))}
    </div>
  );

  if (view.phase === 'bidding') {
    return (
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
    );
  }

  if (view.phase === 'trump_selection') {
    if (view.bidding.currentBidderSeat === you) {
      return <TrumpPanel hand={view.hand} bidAmount={view.bidding.currentBid ?? 0} onChoose={actions.pickTrump} />;
    }
    return (
      <>
        <div className="waiting-banner">
          Waiting for {players.find((p) => p.seat === view.bidding.currentBidderSeat)?.name} to pick trump...
        </div>
        {handPreview}
      </>
    );
  }

  if (view.phase === 'playing') {
    return (
      <>
        {view.canRequestTrumpReveal && (
          <button type="button" className="btn btn-call-trump" onClick={actions.callTrump}>
            Call for trump <kbd className="key-hint">T</kbd>
          </button>
        )}
        <Hand cards={displayHand} legalCards={view.legalCards} canPlay={currentTurnSeat === you} onPlay={actions.play} />
      </>
    );
  }

  return null;
}
