import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type BotDifficulty,
  type Card,
  type GameState,
  type Player,
  type PlayerView,
  type Seat,
  chooseTrump,
  createGame,
  decideBotAction,
  declareDouble,
  declareRedouble,
  getCurrentActorSeat,
  getPlayerView,
  placeBid,
  playCard,
  requestTrumpReveal,
  startNextRound,
} from '@twenty-eight/engine';

import { TRICK_ANIM_TOTAL_MS } from '../components/TrickArea';

const HUMAN_SEAT: Seat = 0;
const BOT_DELAY_MS = 700;
// When a bot leads a fresh kai, the previous kai is still resting/sweeping on
// the table — wait for that to finish so its 4th card stays visible.
const BOT_LEAD_DELAY_MS = TRICK_ANIM_TOTAL_MS + 150;

function buildPlayers(humanName: string): Player[] {
  const botNames = ['Anitha', 'Rajan', 'Deepa'];
  return [0, 1, 2, 3].map((seat) => ({
    id: seat === HUMAN_SEAT ? 'you' : `bot-${seat}`,
    name: seat === HUMAN_SEAT ? humanName || 'You' : botNames[seat - 1],
    seat: seat as Seat,
    isBot: seat !== HUMAN_SEAT,
    connected: true,
  }));
}

export function useLocalGame(humanName: string, baseCardsPerTeam: number, difficulty: BotDifficulty = 'regular') {
  const [state, setState] = useState<GameState>(() => createGame(buildPlayers(humanName), { baseCardsPerTeam }));
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (botTimer.current) {
      clearTimeout(botTimer.current);
      botTimer.current = null;
    }
    const actor = getCurrentActorSeat(state);
    if (actor === null || actor === HUMAN_SEAT) return;

    // A bot about to lead a fresh kai (after the first) waits for the
    // previous kai's rest+sweep animation to finish before playing.
    const leadingFreshKai =
      state.phase === 'playing' && state.trick.cards.length === 0 && state.completedTricks.length > 0;
    const delay = leadingFreshKai ? BOT_LEAD_DELAY_MS : BOT_DELAY_MS;

    botTimer.current = setTimeout(() => {
      setState((prev) => {
        const seat = getCurrentActorSeat(prev);
        if (seat === null || seat === HUMAN_SEAT) return prev;
        try {
          const view = getPlayerView(prev, seat);
          const action = decideBotAction(view, difficulty);
          if (action.type === 'bid') return placeBid(prev, seat, action.value);
          if (action.type === 'trump') return chooseTrump(prev, seat, action.card);
          if (action.type === 'double') return declareDouble(prev, seat, action.accept);
          if (action.type === 'redouble') return declareRedouble(prev, seat, action.accept);
          if (action.type === 'reveal') return requestTrumpReveal(prev, seat);
          if (action.type === 'play') return playCard(prev, seat, action.card);
          return prev;
        } catch (err) {
          console.error('Bot action failed', err);
          return prev;
        }
      });
    }, delay);

    return () => {
      if (botTimer.current) clearTimeout(botTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const view: PlayerView = getPlayerView(state, HUMAN_SEAT);

  const bid = useCallback((value: 'pass' | number) => {
    setState((prev) => {
      try {
        return placeBid(prev, HUMAN_SEAT, value);
      } catch (err) {
        console.error(err);
        return prev;
      }
    });
  }, []);

  const pickTrump = useCallback((card: Card) => {
    setState((prev) => {
      try {
        return chooseTrump(prev, HUMAN_SEAT, card);
      } catch (err) {
        console.error(err);
        return prev;
      }
    });
  }, []);

  const callTrump = useCallback(() => {
    setState((prev) => {
      try {
        return requestTrumpReveal(prev, HUMAN_SEAT);
      } catch (err) {
        console.error(err);
        return prev;
      }
    });
  }, []);

  const play = useCallback((card: Card) => {
    setState((prev) => {
      try {
        return playCard(prev, HUMAN_SEAT, card);
      } catch (err) {
        console.error(err);
        return prev;
      }
    });
  }, []);

  const double = useCallback((accept: boolean) => {
    setState((prev) => {
      try {
        return declareDouble(prev, HUMAN_SEAT, accept);
      } catch (err) {
        console.error(err);
        return prev;
      }
    });
  }, []);

  const redouble = useCallback((accept: boolean) => {
    setState((prev) => {
      try {
        return declareRedouble(prev, HUMAN_SEAT, accept);
      } catch (err) {
        console.error(err);
        return prev;
      }
    });
  }, []);

  const nextRound = useCallback(() => {
    setState((prev) => startNextRound(prev));
  }, []);

  const restart = useCallback(() => {
    setState(createGame(buildPlayers(humanName), { baseCardsPerTeam }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [humanName, baseCardsPerTeam]);

  return { state, view, humanSeat: HUMAN_SEAT, bid, pickTrump, callTrump, play, double, redouble, nextRound, restart };
}
