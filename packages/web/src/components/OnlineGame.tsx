import { useState } from 'react';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { GameScreen } from './GameScreen';

interface OnlineGameProps {
  name: string;
  roomCode: string;
  onExit: () => void;
}

export function OnlineGame({ name, roomCode, onExit }: OnlineGameProps) {
  const { status, error, seat, room, view, startGame, bid, pickTrump, callTrump, play, nextRound } = useOnlineGame(
    name,
    roomCode
  );
  const [targetScore, setTargetScore] = useState(6);

  if (status === 'error') {
    return (
      <div className="home">
        <h2>Connection problem</h2>
        <p>{error ?? 'Could not reach the game server.'}</p>
        <button type="button" className="btn-link" onClick={onExit}>
          &larr; Back home
        </button>
      </div>
    );
  }

  if (status === 'connecting' || seat === null || !room) {
    return (
      <div className="home">
        <h2>Joining room {roomCode}...</h2>
      </div>
    );
  }

  if (!room.started) {
    const isHost = seat === 0;
    return (
      <div className="home">
        <h1>Room {roomCode}</h1>
        <p className="subtitle">Share this code with 3 friends, or start with bots filling empty seats.</p>
        <div className="home-section">
          <h2>Seats</h2>
          <ul className="seat-list">
            {room.seats.map((s) => (
              <li key={s.seat}>
                Seat {s.seat + 1}: {s.name ? `${s.name}${s.seat === seat ? ' (you)' : ''}` : 'empty (bot will fill in)'}
              </li>
            ))}
          </ul>
        </div>
        {isHost ? (
          <div className="home-section">
            <label className="field">
              Play to
              <select value={targetScore} onChange={(e) => setTargetScore(Number(e.target.value))}>
                <option value={6}>6 points</option>
                <option value={12}>12 points</option>
                <option value={21}>21 points</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={() => startGame(targetScore)}>
              Start game
            </button>
          </div>
        ) : (
          <p className="waiting-message">Waiting for the host to start the game...</p>
        )}
        {error && <p className="error-message">{error}</p>}
        <button type="button" className="btn-link" onClick={onExit}>
          &larr; Leave room
        </button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="home">
        <h2>Loading game...</h2>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="btn-link exit-link" onClick={onExit}>
        &larr; Leave room
      </button>
      <GameScreen
        view={view}
        actions={{ bid, pickTrump, callTrump, play, nextRound }}
        waitingForHostMessage="Waiting for a player to start the next round..."
      />
    </div>
  );
}
