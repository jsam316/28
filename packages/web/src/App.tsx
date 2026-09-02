import { useState } from 'react';
import type { BotDifficulty, GameState } from '@twenty-eight/engine';
import { Home } from './components/Home';
import { GameScreen } from './components/GameScreen';
import { OnlineLobby } from './components/OnlineLobby';
import { OnlineGame } from './components/OnlineGame';
import { useLocalGame } from './hooks/useLocalGame';

type Screen =
  | { kind: 'home' }
  | { kind: 'local'; name: string; baseCardsPerTeam: number; difficulty: BotDifficulty; resumeFrom?: GameState }
  | { kind: 'online-lobby'; name: string }
  | { kind: 'online-game'; name: string; roomCode: string };

function LocalGame({
  name,
  baseCardsPerTeam,
  difficulty,
  resumeFrom,
  onExit,
}: {
  name: string;
  baseCardsPerTeam: number;
  difficulty: BotDifficulty;
  resumeFrom?: GameState;
  onExit: () => void;
}) {
  const { view, bid, redeal, pickTrump, callTrump, play, nextRound, restart } = useLocalGame(
    name,
    baseCardsPerTeam,
    difficulty,
    resumeFrom
  );
  return (
    <GameScreen
      view={view}
      actions={{ bid, redeal, pickTrump, callTrump, play, nextRound, restart }}
      onExit={onExit}
    />
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });

  if (screen.kind === 'home') {
    return (
      <Home
        onPlaySolo={(name, baseCardsPerTeam, difficulty) => setScreen({ kind: 'local', name, baseCardsPerTeam, difficulty })}
        onResumeSolo={(saved) =>
          setScreen({
            kind: 'local',
            name: saved.humanName,
            baseCardsPerTeam: saved.baseCardsPerTeam,
            difficulty: saved.difficulty,
            resumeFrom: saved.state,
          })
        }
        onGoOnline={(name) => setScreen({ kind: 'online-lobby', name })}
      />
    );
  }

  if (screen.kind === 'local') {
    return (
      <LocalGame
        name={screen.name}
        baseCardsPerTeam={screen.baseCardsPerTeam}
        difficulty={screen.difficulty}
        resumeFrom={screen.resumeFrom}
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
