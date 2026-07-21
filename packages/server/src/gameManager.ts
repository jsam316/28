import type { Server } from 'socket.io';
import {
  type Card,
  type Player,
  type Seat,
  type Suit,
  chooseTrump,
  createGame,
  decideBotAction,
  declareDouble,
  declareRedouble,
  getCurrentActorSeat,
  getPlayerView,
  placeBid,
  playCard,
  requestTrumpReveal,
  startNextRound,
} from '@twenty-eight/engine';
import { type Room, touch } from './rooms.js';

const BOT_NAMES = ['Anitha', 'Rajan', 'Deepa', 'Vinu'];
const BOT_DELAY_MS = 900;
// A bot leading a fresh kai waits for the clients' previous-kai rest+sweep
// animation to finish (see TRICK_ANIM_TOTAL_MS in the web TrickArea).
const BOT_LEAD_DELAY_MS = 1450;

export function broadcastRoom(io: Server, room: Room) {
  const seats = room.slots.map((slot, seat) =>
    slot
      ? { seat, name: slot.name, isBot: slot.isBot, connected: slot.connected }
      : { seat, name: null, isBot: false, connected: false }
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

export function joinRoom(room: Room, seat: Seat, name: string, socketId: string) {
  room.slots[seat] = { seat, name, isBot: false, connected: true, socketId };
  touch(room);
}

export function reconnectRoom(room: Room, seat: Seat, socketId: string) {
  const slot = room.slots[seat];
  if (slot) {
    slot.connected = true;
    slot.socketId = socketId;
  }
  touch(room);
}

export function handleDisconnect(io: Server, room: Room, socketId: string) {
  const slot = room.slots.find((s) => s?.socketId === socketId);
  if (!slot) return;
  slot.connected = false;
  slot.socketId = null;
  if (room.state && room.state.phase !== 'game_end') {
    // A vacant human seat mid-game is taken over by a bot so play can continue.
    slot.isBot = true;
    scheduleBots(io, room);
  }
  broadcastRoom(io, room);
  touch(room);
}

export function startGame(io: Server, room: Room, baseCardsPerTeam: number) {
  const players: Player[] = [0, 1, 2, 3].map((seat) => {
    const slot = room.slots[seat as Seat];
    if (slot) return { id: slot.socketId ?? `seat-${seat}`, name: slot.name, seat: seat as Seat, isBot: false, connected: true };
    room.slots[seat as Seat] = {
      seat: seat as Seat,
      name: BOT_NAMES[seat],
      isBot: true,
      connected: true,
      socketId: null,
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

export function applyTrump(room: Room, seat: Seat, suit: Suit) {
  if (!room.state) throw new Error('Game not started');
  room.state = chooseTrump(room.state, seat, suit);
  touch(room);
}

export function applyDouble(room: Room, seat: Seat, accept: boolean) {
  if (!room.state) throw new Error('Game not started');
  room.state = declareDouble(room.state, seat, accept);
  touch(room);
}

export function applyRedouble(room: Room, seat: Seat, accept: boolean) {
  if (!room.state) throw new Error('Game not started');
  room.state = declareRedouble(room.state, seat, accept);
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
      if (action.type === 'bid') room.state = placeBid(room.state, seat, action.value);
      else if (action.type === 'trump') room.state = chooseTrump(room.state, seat, action.suit);
      else if (action.type === 'double') room.state = declareDouble(room.state, seat, action.accept);
      else if (action.type === 'redouble') room.state = declareRedouble(room.state, seat, action.accept);
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
