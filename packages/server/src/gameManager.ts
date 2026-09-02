import type { Server } from 'socket.io';
import {
  type Card,
  type GameState,
  type Player,
  type Seat,
  chooseTrump,
  createGame,
  decideBotAction,
  demandRedeal,
  getCurrentActorSeat,
  getPlayerView,
  placeBid,
  playCard,
  requestTrumpReveal,
  startNextRound,
} from '@twenty-eight/engine';
import { type Room, type RoomPlayer, touch } from './rooms.js';

const BOT_NAMES = ['Anitha', 'Rajan', 'Deepa', 'Vinu'];
const BOT_DELAY_MS = 900;
// A bot leading a fresh kai waits for the clients' previous-kai rest+sweep
// animation to finish (see TRICK_ANIM_TOTAL_MS in the web TrickArea).
const BOT_LEAD_DELAY_MS = 1450;
// How long a dropped player keeps their seat before a bot takes over, so a
// brief network blip or a locked phone does not hand the hand to a bot.
const TAKEOVER_GRACE_MS = 20_000;

export function broadcastRoom(io: Server, room: Room) {
  const seats = room.slots.map((slot, seat) =>
    slot
      ? { seat, name: slot.name, isBot: slot.isBot, connected: slot.connected, ready: slot.ready }
      : { seat, name: null, isBot: false, connected: false, ready: false }
  );
  io.to(room.code).emit('room:state', {
    roomCode: room.code,
    seats,
    started: room.state !== null,
  });

  if (!room.state) return;
  for (const slot of room.slots) {
    if (slot && !slot.isBot && slot.socketId) {
      const view = getPlayerView(room.state, slot.seat);
      io.to(slot.socketId).emit('game:view', view);
    }
  }
}

// Keep the players list inside the game state in step with the room, so
// every client can show who is offline or bot-controlled.
function syncPlayers(room: Room) {
  if (!room.state) return;
  const players: Player[] = room.state.players.map((p) => {
    const slot = room.slots[p.seat];
    return slot ? { ...p, name: slot.name, isBot: slot.isBot, connected: slot.connected } : p;
  });
  room.state = { ...room.state, players } as GameState;
}

export function joinRoom(room: Room, seat: Seat, name: string, socketId: string, playerId: string | null) {
  room.slots[seat] = {
    seat,
    name,
    isBot: false,
    connected: true,
    ready: seat === 0, // the host is implicitly ready
    socketId,
    playerId,
    takeoverTimer: null,
  };
  syncPlayers(room);
  touch(room);
}

export function reconnectRoom(room: Room, seat: Seat, socketId: string, playerId: string | null) {
  const slot = room.slots[seat];
  if (!slot) return;
  if (slot.takeoverTimer) {
    clearTimeout(slot.takeoverTimer);
    slot.takeoverTimer = null;
  }
  slot.connected = true;
  slot.socketId = socketId;
  slot.isBot = false; // a bot that filled in while they were away steps aside
  if (playerId) slot.playerId = playerId;
  syncPlayers(room);
  touch(room);
}

// The seat a returning player should get back: their own by player id first,
// then (for clients without one) a disconnected seat carrying their name.
export function findReturningSeat(room: Room, playerId: string | null, name: string): RoomPlayer | undefined {
  if (playerId) {
    const own = room.slots.find((s) => s?.playerId === playerId);
    if (own) return own;
  }
  return room.slots.find((s) => s && !s.connected && !s.isBot && s.name.toLowerCase() === name.toLowerCase()) ?? undefined;
}

export function setReady(room: Room, seat: Seat, ready: boolean) {
  const slot = room.slots[seat];
  if (slot && !slot.isBot) slot.ready = ready;
  touch(room);
}

// Every connected human other than the host must have tapped Ready.
export function unreadyPlayers(room: Room): RoomPlayer[] {
  return room.slots.filter((s): s is RoomPlayer => !!s && !s.isBot && s.connected && s.seat !== 0 && !s.ready);
}

export function handleDisconnect(io: Server, room: Room, socketId: string) {
  const slot = room.slots.find((s) => s?.socketId === socketId);
  if (!slot) return;
  slot.connected = false;
  slot.socketId = null;

  if (room.state && room.state.phase !== 'game_end') {
    // Hold the seat for a while; if they do not come back a bot takes over so
    // play can continue for everyone else.
    if (slot.takeoverTimer) clearTimeout(slot.takeoverTimer);
    slot.takeoverTimer = setTimeout(() => {
      slot.takeoverTimer = null;
      if (slot.connected) return;
      slot.isBot = true;
      syncPlayers(room);
      broadcastRoom(io, room);
      scheduleBots(io, room);
    }, TAKEOVER_GRACE_MS);
  } else if (!room.state) {
    // Not started: a dropped player simply frees the seat.
    room.slots[slot.seat] = null;
  }
  syncPlayers(room);
  broadcastRoom(io, room);
  touch(room);
}

// A player deliberately leaving the room (back to the home screen).
export function leaveRoom(io: Server, room: Room, socketId: string) {
  const slot = room.slots.find((s) => s?.socketId === socketId);
  if (!slot) return;
  slot.playerId = null; // do not hand the seat back automatically
  handleDisconnect(io, room, socketId);
}

export function startGame(io: Server, room: Room, baseCardsPerTeam: number) {
  const players: Player[] = [0, 1, 2, 3].map((seat) => {
    const slot = room.slots[seat as Seat];
    if (slot) return { id: slot.playerId ?? slot.socketId ?? `seat-${seat}`, name: slot.name, seat: seat as Seat, isBot: false, connected: true };
    room.slots[seat as Seat] = {
      seat: seat as Seat,
      name: BOT_NAMES[seat],
      isBot: true,
      connected: true,
      ready: true,
      socketId: null,
      playerId: null,
      takeoverTimer: null,
    };
    return { id: `bot-${seat}`, name: BOT_NAMES[seat], seat: seat as Seat, isBot: true, connected: true };
  });

  room.state = createGame(players, { baseCardsPerTeam });
  touch(room);
  broadcastRoom(io, room);
  scheduleBots(io, room);
}

export function applyBid(room: Room, seat: Seat, value: 'pass' | number) {
  if (!room.state) throw new Error('Game not started');
  room.state = placeBid(room.state, seat, value);
  touch(room);
}

export function applyRedeal(room: Room, seat: Seat) {
  if (!room.state) throw new Error('Game not started');
  room.state = demandRedeal(room.state, seat);
  touch(room);
}

export function applyTrump(room: Room, seat: Seat, card: Card) {
  if (!room.state) throw new Error('Game not started');
  room.state = chooseTrump(room.state, seat, card);
  touch(room);
}

export function applyReveal(room: Room, seat: Seat) {
  if (!room.state) throw new Error('Game not started');
  room.state = requestTrumpReveal(room.state, seat);
  touch(room);
}

export function applyPlay(room: Room, seat: Seat, card: Card) {
  if (!room.state) throw new Error('Game not started');
  room.state = playCard(room.state, seat, card);
  touch(room);
}

export function applyNextRound(room: Room) {
  if (!room.state) throw new Error('Game not started');
  room.state = startNextRound(room.state);
  touch(room);
}

export function scheduleBots(io: Server, room: Room) {
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
  if (!room.state) return;
  const actor = getCurrentActorSeat(room.state);
  if (actor === null) return;
  const slot = room.slots[actor];
  if (!slot?.isBot) return;

  const leadingFreshKai =
    room.state.phase === 'playing' && room.state.trick.cards.length === 0 && room.state.completedTricks.length > 0;
  const delay = leadingFreshKai ? BOT_LEAD_DELAY_MS : BOT_DELAY_MS;

  room.botTimer = setTimeout(() => {
    if (!room.state) return;
    const seat = getCurrentActorSeat(room.state);
    if (seat === null) return;
    const slotNow = room.slots[seat];
    if (!slotNow?.isBot) return;
    try {
      const view = getPlayerView(room.state, seat);
      const action = decideBotAction(view);
      if (action.type === 'redeal') room.state = demandRedeal(room.state, seat);
      else if (action.type === 'bid') room.state = placeBid(room.state, seat, action.value);
      else if (action.type === 'trump') room.state = chooseTrump(room.state, seat, action.card);
      else if (action.type === 'reveal') room.state = requestTrumpReveal(room.state, seat);
      else if (action.type === 'play') room.state = playCard(room.state, seat, action.card);
    } catch (err) {
      console.error('Bot action failed in room', room.code, err);
    }
    touch(room);
    broadcastRoom(io, room);
    scheduleBots(io, room);
  }, delay);
}
