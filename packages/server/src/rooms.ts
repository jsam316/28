import type { GameState, Seat } from '@twenty-eight/engine';

export interface RoomPlayer {
  seat: Seat;
  name: string;
  isBot: boolean;
  connected: boolean;
  socketId: string | null;
}

export interface Room {
  code: string;
  slots: (RoomPlayer | null)[]; // length 4, index = seat
  state: GameState | null;
  createdAt: number;
  lastActivity: number;
  botTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();

export function createRoom(code: string): Room {
  const room: Room = {
    code,
    slots: [null, null, null, null],
    state: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    botTimer: null,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function getOrCreateRoom(code: string): Room {
  return rooms.get(code) ?? createRoom(code);
}

export function findOpenSeat(room: Room): Seat | null {
  for (let s = 0; s < 4; s++) {
    if (room.slots[s] === null) return s as Seat;
  }
  return null;
}

export function touch(room: Room) {
  room.lastActivity = Date.now();
}

const STALE_MS = 3 * 60 * 60 * 1000;

export function cleanupStaleRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > STALE_MS) {
      if (room.botTimer) clearTimeout(room.botTimer);
      rooms.delete(code);
    }
  }
}
