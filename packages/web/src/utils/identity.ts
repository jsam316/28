import { loadJSON, saveJSON } from './storage';

// A per-browser secret that lets a player who drops (a phone locking, a train
// tunnel, a server restart) reclaim the same seat when they reconnect. It is
// never shown to other players, so it must be unguessable: always from the
// crypto generator.
function freshId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const VALID = /^[A-Za-z0-9_-]{16,64}$/;

export function getPlayerId(): string {
  const existing = loadJSON<string | null>('playerId', null);
  if (existing && VALID.test(existing)) return existing;
  const fresh = freshId();
  saveJSON('playerId', fresh);
  return fresh;
}
