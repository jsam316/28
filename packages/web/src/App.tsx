import { useState } from 'react';
import type { BotDifficulty } from '@twenty-eight/engine';
import { Home } from './components/Home';
import { GameScreen } from './components/GameScreen';
import { OnlineLobby } from './components/OnlineLobby';
import { OnlineGame } from './components/OnlineGame';
import { useLocalGame } from './hooks/useLocalGame';

type Screen =
  | { kind: 'home' }
  | { kind: 'local'; name: string; targetScore: number; difficulty: BotDifficulty }
  | { kind: 'online-lobby'; name: string }
  | { kind: 'online-game'; name: string; roomCode: string };

function LocalGame({
  name,
  targetScore,
  difficulty,
  onExit,
}: {
  name: string;
  targetScore: number;
  difficulty: BotDifficulty;
  onExit: () => void;
}) {
  const { view, bid, pickTrump, callTrump, play, nextRound, restart } = useLocalGame(name, targetScore, difficulty);
  return <GameScreen view={view} actions={{ bid, pickTrump, callTrump, play, nextRound, restart }} onExit={onExit} />;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });

  if (screen.kind === 'home') {
    return (
      <Home
        onPlaySolo={(name, targetScore, difficulty) => setScreen({ kind: 'local', name, targetScore, difficulty })}
        onGoOnline={(name) => setScreen({ kind: 'online-lobby', name })}
      />
    );
  }

  if (screen.kind === 'local') {
    return (
      <LocalGame
        name={screen.name}
        targetScore={screen.targetScore}
        difficulty={screen.difficulty}
        onExit={() => setScreen({ kind: 'home' })}
      />
    );
  }

  if (screen.kind === 'online-lobby') {
    return (
      <OnlineLobby
        name={screen.name}
        onJoined={(roomCode) => setScreen({ kind: 'online-game', name: screen.name, roomCode })}
        onExit={() => setScreen({ kind: 'home' })}
      />
    );
  }

  return <OnlineGame name={screen.name} roomCode={screen.roomCode} onExit={() => setScreen({ kind: 'home' })} />;
}
