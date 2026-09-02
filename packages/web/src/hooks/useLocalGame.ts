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
  demandRedeal,
  getCurrentActorSeat,
  getPlayerView,
  placeBid,
  playCard,
  requestTrumpReveal,
  startNextRound,
} from '@twenty-eight/engine';

import { TRICK_ANIM_TOTAL_MS } from '../components/TrickArea';
import { loadJSON, removeKey, saveJSON } from '../utils/storage';

const HUMAN_SEAT: Seat = 0;
const BOT_DELAY_MS = 700;
// When a bot leads a fresh kai, the previous kai is still resting/sweeping on
// the table — wait for that to finish so its 4th card stays visible.
const BOT_LEAD_DELAY_MS = TRICK_ANIM_TOTAL_MS + 150;

const SAVE_KEY = 'localGame';

// A solo match in progress, kept in localStorage so closing the tab (or the
// PWA) mid-game loses nothing.
export interface SavedLocalGame {
  version: 1;
  savedAt: number;
  humanName: string;
  baseCardsPerTeam: number;
  difficulty: BotDifficulty;
  state: GameState;
}

export function loadSavedLocalGame(): SavedLocalGame | null {
  const saved = loadJSON<SavedLocalGame | null>(SAVE_KEY, null);
  if (!saved || saved.version !== 1 || !saved.state || saved.state.phase === 'game_end') return null;
  return saved;
}

export function clearSavedLocalGame() {
  removeKey(SAVE_KEY);
}

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

export function useLocalGame(
  humanName: string,
  baseCardsPerTeam: number,
  difficulty: BotDifficulty = 'regular',
  resumeFrom?: GameState
) {
  const [state, setState] = useState<GameState>(
    () => resumeFrom ?? createGame(buildPlayers(humanName), { baseCardsPerTeam })
  );
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist after every change; a finished match is dropped so the home
  // screen does not offer to resume it.
  useEffect(() => {
    if (state.phase === 'game_end') {
      clearSavedLocalGame();
      return;
    }
    const saved: SavedLocalGame = { version: 1, savedAt: Date.now(), humanName, baseCardsPerTeam, difficulty, state };
    saveJSON(SAVE_KEY, saved);
  }, [state, humanName, baseCardsPerTeam, difficulty]);

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
          if (action.type === 'redeal') return demandRedeal(prev, seat);
          if (action.type === 'bid') return placeBid(prev, seat, action.value);
          if (action.type === 'trump') return chooseTrump(prev, seat, action.card);
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

  // Every human action goes through the engine, which throws on anything
  // illegal; the state is simply left alone in that case.
  const attempt = useCallback((fn: (prev: GameState) => GameState) => {
    setState((prev) => {
      try {
        return fn(prev);
      } catch (err) {
        console.error(err);
        return prev;
      }
    });
  }, []);

  const bid = useCallback((value: 'pass' | number) => attempt((prev) => placeBid(prev, HUMAN_SEAT, value)), [attempt]);
  const redeal = useCallback(() => attempt((prev) => demandRedeal(prev, HUMAN_SEAT)), [attempt]);
  const pickTrump = useCallback((card: Card) => attempt((prev) => chooseTrump(prev, HUMAN_SEAT, card)), [attempt]);
  const callTrump = useCallback(() => attempt((prev) => requestTrumpReveal(prev, HUMAN_SEAT)), [attempt]);
  const play = useCallback((card: Card) => attempt((prev) => playCard(prev, HUMAN_SEAT, card)), [attempt]);
  const nextRound = useCallback(() => setState((prev) => startNextRound(prev)), []);

  const restart = useCallback(() => {
    setState(createGame(buildPlayers(humanName), { baseCardsPerTeam }));
  }, [humanName, baseCardsPerTeam]);

  return {
    state,
    view,
    humanSeat: HUMAN_SEAT,
    bid,
    redeal,
    pickTrump,
    callTrump,
    play,
    nextRound,
    restart,
  };
}
