import { useEffect, useRef } from 'react';
import { getCurrentActorSeat, teamOf, type PlayerView } from '@twenty-eight/engine';
import { sounds } from '../audio/sounds';
import { TRICK_REST_MS } from '../components/TrickArea';

// Watches successive views of the game and plays the matching effect for
// whatever just changed: a card hitting the table, a kai swept away, the
// trump called, a bid placed, a new deal, your turn arriving, and the round's
// outcome for your team.
export function useGameSounds(view: PlayerView, roundEndDelayMs: number) {
  const prev = useRef<PlayerView | null>(null);

  useEffect(() => {
    const last = prev.current;
    prev.current = view;
    if (!last) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const newDeal = view.roundNumber !== last.roundNumber || (view.phase === 'bidding' && last.phase !== 'bidding' && last.phase !== 'trump_selection');
    if (newDeal) sounds.play('deal');

    if (view.bidding.history.length > last.bidding.history.length && view.roundNumber === last.roundNumber) {
      sounds.play('bid');
    }

    if (view.trick.cards.length > last.trick.cards.length) sounds.play('card');
    if (view.completedTricks.length > last.completedTricks.length && view.completedTricks.length > 0) {
      // The fourth card lands first (card sound), then the kai sweeps away.
      sounds.play('card');
      timers.push(setTimeout(() => sounds.play('sweep'), TRICK_REST_MS));
    }

    if (view.trump.revealed && !last.trump.revealed && view.phase === 'playing') sounds.play('trump');

    const actorNow = getCurrentActorSeat(view);
    const actorBefore = getCurrentActorSeat(last);
    if (actorNow === view.you && actorBefore !== view.you && (view.phase === 'playing' || view.phase === 'bidding')) {
      // Give the card-landing sound a beat before the turn ping.
      timers.push(setTimeout(() => sounds.play('turn'), 180));
    }

    const ended = (view.phase === 'round_end' || view.phase === 'game_end') && last.phase === 'playing';
    if (ended) {
      const result = view.history[view.history.length - 1];
      if (result) {
        const won = result.roundWinnerTeam === teamOf(view.you);
        timers.push(setTimeout(() => sounds.play(won ? 'win' : 'lose'), roundEndDelayMs));
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [view, roundEndDelayMs]);
}
