import { useCallback, useEffect, useState } from 'react';
import type { BotDifficulty } from '@twenty-eight/engine';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { loadJSON, saveJSON } from '../utils/storage';
import { type SavedLocalGame, clearSavedLocalGame, loadSavedLocalGame } from '../hooks/useLocalGame';
import { RulesPanel } from './RulesPanel';
import { SoundToggle } from './SoundToggle';

interface HomeProps {
  onPlaySolo: (name: string, baseCardsPerTeam: number, difficulty: BotDifficulty) => void;
  onResumeSolo: (saved: SavedLocalGame) => void;
  onGoOnline: (name: string) => void;
}

interface Settings {
  name: string;
  baseCards: number;
  difficulty: BotDifficulty;
}

const DEFAULT_SETTINGS: Settings = { name: '', baseCards: 6, difficulty: 'regular' };

function describeSaved(saved: SavedLocalGame): string {
  const s = saved.state;
  return `Round ${s.roundNumber} · base cards ${s.baseCards[0]}–${s.baseCards[1]} · ${saved.difficulty} bots`;
}

export function Home({ onPlaySolo, onResumeSolo, onGoOnline }: HomeProps) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...loadJSON<Partial<Settings>>('settings', {}) }));
  const [saved, setSaved] = useState<SavedLocalGame | null>(() => loadSavedLocalGame());
  const [showRules, setShowRules] = useState(false);
  const closeRules = useCallback(() => setShowRules(false), []);
  const online = useOnlineStatus();

  useEffect(() => {
    saveJSON('settings', settings);
  }, [settings]);

  const update = (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch }));
  const { name, baseCards, difficulty } = settings;

  return (
    <div className="home">
      <div className="home-toolbar">
        <button type="button" className="btn-link" onClick={() => setShowRules(true)}>
          How to play
        </button>
        <SoundToggle />
      </div>
      <h1>28</h1>
      <p className="subtitle">The classic Kerala trick-taking card game</p>

      <label className="field">
        Your name
        <input
          type="text"
          value={name}
          maxLength={20}
          placeholder="Enter your name"
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>

      {saved && (
        <div className="home-section resume-section">
          <h2>Game in progress</h2>
          <p className="resume-summary">{describeSaved(saved)}</p>
          <div className="resume-actions">
            <button type="button" className="btn btn-primary" onClick={() => onResumeSolo(saved)}>
              Resume game
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                clearSavedLocalGame();
                setSaved(null);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="home-section">
        <h2>Single player</h2>
        <label className="field">
          Base cards per team
          <select value={baseCards} onChange={(e) => update({ baseCards: Number(e.target.value) })}>
            <option value={3}>3 — quick match (collect 6)</option>
            <option value={6}>6 — classic (collect 12)</option>
            <option value={9}>9 — marathon (collect 18)</option>
          </select>
        </label>
        <label className="field">
          Bot difficulty
          <select value={difficulty} onChange={(e) => update({ difficulty: e.target.value as BotDifficulty })}>
            <option value="rookie">Rookie — overbids, occasional mistakes</option>
            <option value="regular">Regular — sensible bids, feeds its partner</option>
            <option value="expert">Expert — counts every card, plays the endgame out</option>
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onPlaySolo(name || 'You', baseCards, difficulty)}
        >
          {saved ? 'Start a new game' : 'Play vs Bots'}
        </button>
      </div>

      <div className="home-section">
        <h2>Online multiplayer</h2>
        <p>Play with 3 friends in real time, each on their own device.</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onGoOnline(name || 'You')}
          disabled={!online}
        >
          Play Online
        </button>
        {!online && <p className="offline-note">You're offline — single player still works.</p>}
      </div>

      {showRules && <RulesPanel onClose={closeRules} />}
    </div>
  );
}
