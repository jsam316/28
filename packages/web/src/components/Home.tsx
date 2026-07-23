import { useState } from 'react';
import type { BotDifficulty } from '@twenty-eight/engine';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface HomeProps {
  onPlaySolo: (name: string, baseCardsPerTeam: number, difficulty: BotDifficulty) => void;
  onGoOnline: (name: string) => void;
}

export function Home({ onPlaySolo, onGoOnline }: HomeProps) {
  const [name, setName] = useState('');
  const [baseCards, setBaseCards] = useState(6);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('regular');
  const online = useOnlineStatus();

  return (
    <div className="home">
      <h1>28</h1>
      <p className="subtitle">The classic Kerala trick-taking card game</p>

      <label className="field">
        Your name
        <input
          type="text"
          value={name}
          maxLength={20}
          placeholder="Enter your name"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="home-section">
        <h2>Single player</h2>
        <label className="field">
          Base cards per team
          <select value={baseCards} onChange={(e) => setBaseCards(Number(e.target.value))}>
            <option value={3}>3 — quick match (collect 6)</option>
            <option value={6}>6 — classic (collect 12)</option>
            <option value={9}>9 — marathon (collect 18)</option>
          </select>
        </label>
        <label className="field">
          Bot difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as BotDifficulty)}>
            <option value="rookie">Rookie — erratic bidding, occasional mistakes</option>
            <option value="regular">Regular — solid, sensible play</option>
            <option value="expert">Expert — sharp bidding, few openings</option>
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onPlaySolo(name || 'You', baseCards, difficulty)}
        >
          Play vs Bots
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
    </div>
  );
}
