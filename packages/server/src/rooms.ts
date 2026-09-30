import type { GameState, Seat } from '@twenty-eight/engine';

export interface RoomPlayer {
  seat: Seat;
  name: string;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  socketId: string | null;
  // Secret per-browser id: the only way to reclaim this seat after a drop.
  // Never sent to other players.
  playerId: string | null;
  // Pending hand-over of this seat to a bot after a disconnect.
  takeoverTimer: ReturnType<typeof setTimeout> | null;
}

export interface Room {
  code: string;
  slots: (RoomPlayer | null)[]; // length 4, index = seat
  state: GameState | null;
  createdAt: number;
  lastActivity: number;
  // Last time any human was connected: rooms left to bots are cleaned up.
  lastHumanSeen: number;
  botTimer: ReturnType<typeof setTimeout> | null;
}

export class RoomStore {
  private rooms = new Map<string, Room>();

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  create(code: string): Room {
    const now = Date.now();
    const room: Room = {
      code,
      slots: [null, null, null, null],
      state: null,
      createdAt: now,
      lastActivity: now,
      lastHumanSeen: now,
      botTimer: null,
    };
    this.rooms.set(code, room);
    return room;
  }

  delete(room: Room): void {
    if (room.botTimer) clearTimeout(room.botTimer);
    for (const slot of room.slots) {
      if (slot?.takeoverTimer) clearTimeout(slot.takeoverTimer);
    }
    this.rooms.delete(room.code);
  }

  // Drop rooms nobody is using: no connected human for `idleMs`, or no
  // activity at all for `staleMs`.
  cleanup(idleMs: number, staleMs: number): number {
    const now = Date.now();
    let removed = 0;
    for (const room of this.rooms.values()) {
      if (hasConnectedHuman(room)) room.lastHumanSeen = now;
      if (now - room.lastHumanSeen > idleMs || now - room.lastActivity > staleMs) {
        this.delete(room);
        removed++;
      }
    }
    return removed;
  }

  all(): IterableIterator<Room> {
    return this.rooms.values();
  }
}

export function findOpenSeat(room: Room): Seat | null {
  for (let s = 0; s < 4; s++) {
    if (room.slots[s] === null) return s as Seat;
  }
  return null;
}

export function hasConnectedHuman(room: Room): boolean {
  return room.slots.some((s) => !!s && !s.isBot && s.connected);
}

export function touch(room: Room) {
  room.lastActivity = Date.now();
  if (hasConnectedHuman(room)) room.lastHumanSeen = room.lastActivity;
}
