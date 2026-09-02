import { io, type Socket } from 'socket.io-client';

export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      // Keep trying: the free-tier server can take a minute to wake up, and a
      // phone coming back from a tunnel should pick its seat straight back up.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

// Ping the server's health endpoint so a sleeping instance starts waking up
// before the player has even picked a room. Errors are irrelevant here.
export function prewarmServer(): void {
  try {
    void fetch(`${SERVER_URL}/health`, { mode: 'cors', cache: 'no-store' }).catch(() => undefined);
  } catch {
    // ignore
  }
}
