import { loadJSON, saveJSON } from './storage';

// A stable per-browser id so a player who drops (a phone locking, a train
// tunnel, a server restart) can reclaim the same seat when they reconnect.
export function getPlayerId(): string {
  const existing = loadJSON<string | null>('playerId', null);
  if (existing) return existing;
  const fresh =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  saveJSON('playerId', fresh);
  return fresh;
}
