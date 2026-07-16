import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type BotDifficulty,
  type Card,
  type GameState,
  type Player,
  type PlayerView,
  type Seat,
  type Suit,
  chooseTrump,
  createGame,
  decideBotAction,
  getCurrentActorSeat,
  getPlayerView,
  placeBid,
  playCard,
  requestTrumpReveal,
  startNextRound,
} from '@twenty-eight/engine';

const HUMAN_SEAT: Seat = 0;
const BOT_DELAY_MS = 700;

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

export function useLocalGame(humanName: string, targetScore: number, difficulty: BotDifficulty = 'regular') {
  const [state, setState] = useState<GameState>(() => createGame(buildPlayers(humanName), { targetScore }));
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (botTimer.current) {
      clearTimeout(botTimer.current);
      botTimer.current = null;
    }
    const actor = getCurrentActorSeat(state);
    if (actor === null || actor === HUMAN_SEAT) return;

    botTimer.current = setTimeout(() => {
      setState((prev) => {
        const seat = getCurrentActorSeat(prev);
        if (seat === null || seat === HUMAN_SEAT) return prev;
        try {
          const view = getPlayerView(prev, seat);
          const action = decideBotAction(view, difficulty);
          if (action.type === 'bid') return placeBid(prev, seat, action.value);
          if (action.type === 'trump') return chooseTrump(prev, seat, action.suit);
          if (action.type === 'reveal') return requestTrumpReveal(prev, seat);
          if (action.type === 'play') return playCard(prev, seat, action.card);
          return prev;
        } catch (err) {
          console.error('Bot action failed', err);
          return prev;
        }
      });
    }, BOT_DELAY_MS);

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

  const pickTrump = useCallback((suit: Suit) => {
    setState((prev) => {
      try {
        return chooseTrump(prev, HUMAN_SEAT, suit);
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

  const nextRound = useCallback(() => {
    setState((prev) => startNextRound(prev));
  }, []);

  const restart = useCallback(() => {
    setState(createGame(buildPlayers(humanName), { targetScore }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [humanName, targetScore]);

  return { state, view, humanSeat: HUMAN_SEAT, bid, pickTrump, callTrump, play, nextRound, restart };
}
