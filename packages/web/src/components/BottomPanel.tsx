import { type Card, type PlayerView, type Seat, cardId } from '@twenty-eight/engine';
import { BiddingPanel } from './BiddingPanel';
import { TrumpPanel } from './TrumpPanel';
import { Hand } from './Hand';
import { PlayingCard } from './Card';
import type { GameScreenActions } from './GameScreen';
import { suitName, suitSymbol } from '../utils/cards';

interface BottomPanelProps {
  view: PlayerView;
  displayHand: Card[];
  currentTurnSeat: Seat | null;
  actions: GameScreenActions;
}

// What the player needs to know when they cannot follow suit: whether their
// trump play needs a call first (nothing counts as a trump until it is exposed), or is an
// ordinary ruff once the trump is out.
function voidHint(view: PlayerView): { text: string; cutSuit: Card['suit'] | null } | null {
  const led = view.trick.cards[0]?.card.suit ?? null;
  if (led === null) return null;
  if (view.legalCards.some((c) => c.suit === led)) return null;
  const trump = view.trump;
  const isDeclarer = trump.chosenBySeat === view.you;
  const declarer = view.players.find((p) => p.seat === trump.chosenBySeat)?.name ?? 'the declarer';
  if (trump.revealed && trump.suit) {
    if (view.legalCards.every((c) => c.suit === trump.suit) && view.legalCards.length > 0) {
      return { text: `You called for the trump, so you must play a ${suitName(trump.suit)} card.`, cutSuit: trump.suit };
    }
    const holdsTrump = view.legalCards.some((c) => c.suit === trump.suit);
    return {
      text: holdsTrump
        ? `You can't follow ${suitName(led)}. Trump with ${suitSymbol(trump.suit)} to take the kai, or discard.`
        : led === trump.suit
          ? `Trumps (${suitName(led)}) were led and you hold none, so whatever you play is a discard.`
          : `You can't follow ${suitName(led)}. Trump is ${suitName(trump.suit)} and you hold none, so whatever you play is a discard — the highest ${suitName(led)} card wins unless someone trumps.`,
      cutSuit: holdsTrump ? trump.suit : null,
    };
  }
  if (isDeclarer && trump.suit) {
    const holdsTrump = view.legalCards.some((c) => c.suit === trump.suit);
    return {
      text: holdsTrump
        ? `You can't follow ${suitName(led)}. Tap Call for trump to expose your ${suitSymbol(trump.suit)} and then trump the kai — a ${suitSymbol(trump.suit)} played without calling is only a discard. Or discard another suit to keep the trump hidden.`
        : `You can't follow ${suitName(led)}. Your only trump is the set-aside card: tap Call for trump to expose it and play it, or discard to keep the trump hidden.`,
      cutSuit: holdsTrump ? trump.suit : null,
    };
  }
  return {
    text: `You can't follow ${suitName(led)}. ${declarer} holds the bid and only they know the trump. Tap Call for trump to expose it (you must then trump if you can), or discard — nothing you play without calling counts as a trump.`,
    cutSuit: null,
  };
}

// Why the declarer's trump-suit cards are greyed out when they lead: the
// trump suit cannot be led while it is still concealed.
function leadHint(view: PlayerView): string | null {
  if (view.trick.cards.length > 0) return null;
  const trump = view.trump;
  if (trump.revealed || trump.chosenBySeat !== view.you || !trump.suit) return null;
  const aside = trump.card ? cardId(trump.card) : '';
  const legal = new Set(view.legalCards.map(cardId));
  const barred = view.hand.some((c) => c.suit === trump.suit && cardId(c) !== aside && !legal.has(cardId(c)));
  return barred
    ? `You can't lead ${suitName(trump.suit)} while the trump is hidden — not until it is exposed or another player leads ${suitName(trump.suit)}.`
    : null;
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
    const yourTurn = currentTurnSeat === you;
    const hint = yourTurn ? voidHint(view) : null;
    const lead = yourTurn ? leadHint(view) : null;
    return (
      <>
        {(hint || lead) && (
          <div className="void-hint" role="status">
            {hint?.text ?? lead}
          </div>
        )}
        {view.canRequestTrumpReveal && (
          <button type="button" className="btn btn-call-trump" onClick={actions.callTrump}>
            Call for trump <kbd className="key-hint">T</kbd>
          </button>
        )}
        <Hand
          cards={displayHand}
          legalCards={view.legalCards}
          canPlay={yourTurn}
          highlightSuit={hint?.cutSuit ?? null}
          onPlay={actions.play}
        />
      </>
    );
  }

  return null;
}
