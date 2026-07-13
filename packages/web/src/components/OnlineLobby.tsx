import { useState } from 'react';

interface OnlineLobbyProps {
  name: string;
  onJoined: (roomCode: string) => void;
  onExit: () => void;
}

function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function OnlineLobby({ name, onJoined, onExit }: OnlineLobbyProps) {
  const [joinCode, setJoinCode] = useState('');

  return (
    <div className="home">
      <h1>28 &middot; Online</h1>
      <p className="subtitle">Playing as {name}</p>

      <div className="home-section">
        <h2>Host a new table</h2>
        <p>Creates a room and invites 3 others to join with a code.</p>
        <button type="button" className="btn btn-primary" onClick={() => onJoined(randomRoomCode())}>
          Create room
        </button>
      </div>

      <div className="home-section">
        <h2>Join a table</h2>
        <label className="field">
          Room code
          <input
            type="text"
            value={joinCode}
            maxLength={6}
            placeholder="ABCDE"
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={joinCode.trim().length === 0}
          onClick={() => onJoined(joinCode.trim())}
        >
          Join room
        </button>
      </div>

      <button type="button" className="btn-link" onClick={onExit}>
        &larr; Back
      </button>
    </div>
  );
}
