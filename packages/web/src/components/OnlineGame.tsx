import { useEffect, useState } from 'react';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { GameScreen } from './GameScreen';

interface OnlineGameProps {
  name: string;
  roomCode: string;
  onExit: () => void;
}

// After this long without a connection, explain that the free-tier server is
// probably asleep and waking up rather than leaving a bare spinner.
const WAKING_HINT_AFTER_MS = 4000;

function useWakingHint(active: boolean): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), WAKING_HINT_AFTER_MS);
    return () => clearTimeout(timer);
  }, [active]);
  return show;
}

export function OnlineGame({ name, roomCode, onExit }: OnlineGameProps) {
  const { status, error, seat, room, view, startGame, setReady, bid, redeal, pickTrump, callTrump, play, nextRound } =
    useOnlineGame(name, roomCode);
  const [baseCards, setBaseCards] = useState(6);
  const wakingHint = useWakingHint(status === 'connecting' || status === 'reconnecting');

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
        {wakingHint && (
          <p className="waiting-message">
            The game server is waking up. Free hosting sleeps when idle, so the first connection can take up to a
            minute — hang on.
          </p>
        )}
        <button type="button" className="btn-link" onClick={onExit}>
          &larr; Back home
        </button>
      </div>
    );
  }

  const reconnectBanner =
    status === 'reconnecting'
      ? wakingHint
        ? 'Connection lost — reconnecting… (the server may be waking up; your seat is kept for you)'
        : 'Connection lost — reconnecting…'
      : null;

  if (!room.started) {
    const isHost = seat === 0;
    const me = room.seats[seat];
    const humansOtherThanHost = room.seats.filter((s) => s.name && !s.isBot && s.seat !== 0);
    const allReady = humansOtherThanHost.every((s) => s.ready);
    return (
      <div className="home">
        <h1>Room {roomCode}</h1>
        <p className="subtitle">Share this code with 3 friends, or start with bots filling empty seats.</p>
        {reconnectBanner && (
          <div className="connection-banner" role="status">
            {reconnectBanner}
          </div>
        )}
        <div className="home-section">
          <h2>Seats</h2>
          <ul className="seat-list">
            {room.seats.map((s) => (
              <li key={s.seat}>
                Seat {s.seat + 1}:{' '}
                {s.name ? (
                  <>
                    {s.name}
                    {s.seat === seat ? ' (you)' : ''}
                    {s.seat === 0 ? ' · host' : s.ready ? ' · ready' : s.connected ? ' · not ready' : ' · offline'}
                  </>
                ) : (
                  'empty (bot will fill in)'
                )}
              </li>
            ))}
          </ul>
        </div>
        {isHost ? (
          <div className="home-section">
            <label className="field">
              Base cards per team
              <select value={baseCards} onChange={(e) => setBaseCards(Number(e.target.value))}>
                <option value={3}>3 — quick match (collect 6)</option>
                <option value={6}>6 — classic (collect 12)</option>
                <option value={9}>9 — marathon (collect 18)</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={() => startGame(baseCards)} disabled={!allReady}>
              Start game
            </button>
            {!allReady && <p className="waiting-message">Waiting for everyone to tap Ready...</p>}
          </div>
        ) : (
          <div className="home-section">
            <button
              type="button"
              className={`btn ${me?.ready ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => setReady(!me?.ready)}
              aria-pressed={me?.ready ?? false}
            >
              {me?.ready ? 'Ready ✓ (tap to undo)' : "I'm ready"}
            </button>
            <p className="waiting-message">
              {me?.ready ? 'Waiting for the host to start the game...' : 'Tap Ready when you are set to play.'}
            </p>
          </div>
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
    <GameScreen
      view={view}
      actions={{ bid, redeal, pickTrump, callTrump, play, nextRound }}
      waitingForHostMessage="Waiting for a player to start the next round..."
      onExit={onExit}
      exitLabel="Leave room"
      banner={reconnectBanner}
    />
  );
}
