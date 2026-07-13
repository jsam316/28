import { useState } from 'react';
import { Home } from './components/Home';
import { GameScreen } from './components/GameScreen';
import { OnlineLobby } from './components/OnlineLobby';
import { OnlineGame } from './components/OnlineGame';
import { useLocalGame } from './hooks/useLocalGame';

type Screen =
  | { kind: 'home' }
  | { kind: 'local'; name: string; targetScore: number }
  | { kind: 'online-lobby'; name: string }
  | { kind: 'online-game'; name: string; roomCode: string };

function LocalGame({ name, targetScore, onExit }: { name: string; targetScore: number; onExit: () => void }) {
  const { view, bid, pickTrump, callTrump, play, nextRound, restart } = useLocalGame(name, targetScore);
  return (
    <div>
      <button type="button" className="btn-link exit-link" onClick={onExit}>
        &larr; Home
      </button>
      <GameScreen view={view} actions={{ bid, pickTrump, callTrump, play, nextRound, restart }} />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });

  if (screen.kind === 'home') {
    return (
      <Home
        onPlaySolo={(name, targetScore) => setScreen({ kind: 'local', name, targetScore })}
        onGoOnline={(name) => setScreen({ kind: 'online-lobby', name })}
      />
    );
  }

  if (screen.kind === 'local') {
    return <LocalGame name={screen.name} targetScore={screen.targetScore} onExit={() => setScreen({ kind: 'home' })} />;
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
