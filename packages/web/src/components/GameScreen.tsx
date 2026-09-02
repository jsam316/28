import { useCallback, useEffect, useState } from 'react';
import { bidTierStake, getCurrentActorSeat, type Card, type PlayerView, type Seat } from '@twenty-eight/engine';
import { PlayerSeat } from './PlayerSeat';
import { seatPosition } from '../utils/seats';
import { TrickArea, TRICK_ANIM_TOTAL_MS } from './TrickArea';
import { Scoreboard } from './Scoreboard';
import { Ticker } from './Ticker';
import { TrumpBanner } from './TrumpBanner';
import { RoundEndOverlay } from './RoundEndOverlay';
import { GameEndOverlay } from './GameEndOverlay';
import { BottomPanel } from './BottomPanel';
import { RulesPanel } from './RulesPanel';
import { SoundToggle } from './SoundToggle';
import { useGameSounds } from '../hooks/useGameSounds';
import { useCardHotkeys } from '../hooks/useCardHotkeys';

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
  // Shown across the top of the table (e.g. "Reconnecting...").
  banner?: string | null;
}

// Hold the table long enough for the final kai to rest and sweep before the
// round-end overlay appears (plus a small beat to read the winner).
const ROUND_END_REVEAL_DELAY_MS = TRICK_ANIM_TOTAL_MS + 250;

// The last trick of a round completes and the round ends in the same state
// update, so without a beat here the final card played (and its sweep-to-
// winner animation) never gets a chance to render before the overlay covers
// the table.
function useDelayedOverlay(phase: PlayerView['phase']): boolean {
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (phase === 'round_end' || phase === 'game_end') {
      const timer = setTimeout(() => setReveal(true), ROUND_END_REVEAL_DELAY_MS);
      return () => clearTimeout(timer);
    }
    setReveal(false);
  }, [phase]);
  return reveal;
}

// When the trump is called, flash the actual card beside the bidder's seat for
// a beat before it "returns to their hand" and disappears from the table.
function useRevealedAside(view: PlayerView): Card | null {
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => {
    if (view.trump.revealed && view.trump.card) {
      setCard(view.trump.card);
      const timer = setTimeout(() => setCard(null), 2200);
      return () => clearTimeout(timer);
    }
    setCard(null);
  }, [view.trump.revealed, view.trump.card]);
  return card;
}

export function GameScreen({ view, actions, waitingForHostMessage, onExit, exitLabel = 'Home', banner }: GameScreenProps) {
  const { you, players } = view;
  const currentTurnSeat = getCurrentActorSeat(view);
  const lastResult = view.history[view.history.length - 1];
  const [showRules, setShowRules] = useState(false);
  const closeRules = useCallback(() => setShowRules(false), []);

  const revealOverlay = useDelayedOverlay(view.phase);
  const showTable = view.phase === 'playing' || ((view.phase === 'round_end' || view.phase === 'game_end') && !revealOverlay);

  const revealedAsideCard = useRevealedAside(view);
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

  useGameSounds(view, ROUND_END_REVEAL_DELAY_MS);
  useCardHotkeys({
    enabled: view.phase === 'playing' && currentTurnSeat === you && !showRules,
    hand: displayHand,
    legalCards: view.legalCards,
    canCallTrump: view.canRequestTrumpReveal,
    onPlay: actions.play,
    onCallTrump: actions.callTrump,
  });

  const latestLine = view.log[view.log.length - 1] ?? '';

  return (
    <div className="game-screen">
      <div className="screen-toolbar">
        {onExit ? (
          <button type="button" className="btn-link exit-link" onClick={onExit}>
            &larr; {exitLabel}
          </button>
        ) : (
          <span />
        )}
        <div className="toolbar-actions">
          <button type="button" className="icon-btn" onClick={() => setShowRules(true)} aria-label="How to play" title="How to play">
            <span aria-hidden="true">?</span>
          </button>
          <SoundToggle />
        </div>
      </div>

      <Scoreboard
        baseCards={view.baseCards}
        totalBaseCards={view.totalBaseCards}
        stakeTier={view.bidding.currentBid !== null ? bidTierStake(view.bidding.currentBid) : 1}
        roundNumber={view.roundNumber}
        trumpSuit={view.trump.suit}
        trumpConcealed={view.trump.concealedForYou}
        history={view.history}
      />

      <Ticker log={view.log} />
      {/* Screen readers hear the latest event without the scrolling ticker. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {latestLine}
      </div>

      {banner && (
        <div className="connection-banner" role="status">
          {banner}
        </div>
      )}

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
          <TrickArea cards={view.phase === 'playing' ? view.trick.cards : []} you={you} completedTricks={view.completedTricks} />
        )}
      </div>

      <div className="bottom-panel">
        <BottomPanel view={view} displayHand={displayHand} currentTurnSeat={currentTurnSeat} actions={actions} />
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

      {showRules && <RulesPanel onClose={closeRules} />}
    </div>
  );
}
