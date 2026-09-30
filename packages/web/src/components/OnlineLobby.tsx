import { useEffect, useState } from 'react';
import { prewarmServer } from '../net/socket';

interface OnlineLobbyProps {
  name: string;
  // create: true when hosting a new table; joining never creates a room.
  onJoined: (roomCode: string, create: boolean) => void;
  onExit: () => void;
}

// Unambiguous alphabet (no 0/O, 1/I). Codes come from the crypto generator so
// they cannot be predicted from earlier ones.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function randomRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // 256 is a multiple of the 32-letter alphabet, so this is unbiased.
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function OnlineLobby({ name, onJoined, onExit }: OnlineLobbyProps) {
  const [joinCode, setJoinCode] = useState('');

  // Start waking the server the moment the player heads online, so it is
  // more likely to be up by the time they pick a room.
  useEffect(() => {
    prewarmServer();
  }, []);

  return (
    <div className="home">
      <h1>28 &middot; Online</h1>
      <p className="subtitle">Playing as {name}</p>

      <div className="home-section">
        <h2>Host a new table</h2>
        <p>Creates a room and invites 3 others to join with a code.</p>
        <button type="button" className="btn btn-primary" onClick={() => onJoined(randomRoomCode(), true)}>
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
            maxLength={8}
            placeholder="ABCDE"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={joinCode.trim().length === 0}
          onClick={() => onJoined(joinCode.trim(), false)}
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
