import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import type { Card, Seat } from '@twenty-eight/engine';
import { cleanupStaleRooms, findOpenSeat, getOrCreateRoom, touch } from './rooms.js';
import {
  applyBid,
  applyNextRound,
  applyPlay,
  applyRedeal,
  applyReveal,
  applyTrump,
  broadcastRoom,
  findReturningSeat,
  handleDisconnect,
  joinRoom,
  leaveRoom,
  reconnectRoom,
  scheduleBots,
  setReady,
  startGame,
  unreadyPlayers,
} from './gameManager.js';

const PORT = Number(process.env.PORT ?? 4000);
// Comma-separated list, e.g. "https://www.28-game.com,https://jsam316.github.io"
const ORIGIN: string | string[] = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim())
  : '*';

const app = express();
app.use(cors({ origin: ORIGIN }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ORIGIN, methods: ['GET', 'POST'] },
});

interface SocketData {
  roomCode?: string;
  seat?: Seat;
}

io.on('connection', (socket) => {
  const data: SocketData = {};

  socket.on('room:join', ({ roomCode, name, playerId }: { roomCode: string; name: string; playerId?: string }) => {
    try {
      const code = (roomCode ?? '').trim().toUpperCase().slice(0, 8);
      if (!code) {
        socket.emit('room:error', { message: 'Enter a room code.' });
        return;
      }
      const cleanName = (name || 'Player').trim().slice(0, 20) || 'Player';
      const cleanPlayerId = typeof playerId === 'string' && playerId.length <= 64 ? playerId : null;
      const room = getOrCreateRoom(code);

      const returning = findReturningSeat(room, cleanPlayerId, cleanName);

      let seat: Seat;
      if (returning) {
        seat = returning.seat;
        reconnectRoom(room, seat, socket.id, cleanPlayerId);
      } else {
        if (room.state && room.state.phase !== 'game_end') {
          socket.emit('room:error', { message: 'That game has already started.' });
          return;
        }
        const open = findOpenSeat(room);
        if (open === null) {
          socket.emit('room:error', { message: 'Room is full.' });
          return;
        }
        seat = open;
        joinRoom(room, seat, cleanName, socket.id, cleanPlayerId);
      }

      data.roomCode = code;
      data.seat = seat;
      socket.join(code);
      socket.emit('room:joined', { roomCode: code, seat });
      broadcastRoom(io, room);
      // A returning human takes back a seat a bot may have been playing.
      scheduleBots(io, room);
    } catch (err) {
      socket.emit('room:error', { message: (err as Error).message });
    }
  });

  socket.on('room:ready', ({ ready }: { ready?: boolean }) => {
    if (!data.roomCode || data.seat === undefined) return;
    const room = getOrCreateRoom(data.roomCode);
    setReady(room, data.seat, ready !== false);
    broadcastRoom(io, room);
  });

  socket.on('room:start', ({ baseCards }: { baseCards?: number }) => {
    if (!data.roomCode) return;
    const room = getOrCreateRoom(data.roomCode);
    try {
      if (data.seat !== 0) throw new Error('Only the host can start the game.');
      if (room.state && room.state.phase !== 'game_end') throw new Error('The game has already started.');
      const waiting = unreadyPlayers(room);
      if (waiting.length > 0) {
        throw new Error(`Waiting for ${waiting.map((p) => p.name).join(', ')} to be ready.`);
      }
      const size = [3, 6, 9].includes(Number(baseCards)) ? Number(baseCards) : 6;
      startGame(io, room, size);
    } catch (err) {
      socket.emit('room:error', { message: (err as Error).message });
    }
  });

  socket.on('game:bid', ({ value }: { value: 'pass' | number }) => {
    withRoom((room) => applyBid(room, data.seat as Seat, value));
  });

  socket.on('game:redeal', () => {
    withRoom((room) => applyRedeal(room, data.seat as Seat));
  });

  socket.on('game:trump', ({ card }: { card: Card }) => {
    withRoom((room) => applyTrump(room, data.seat as Seat, card));
  });

  socket.on('game:revealTrump', () => {
    withRoom((room) => applyReveal(room, data.seat as Seat));
  });

  socket.on('game:play', ({ card }: { card: Card }) => {
    withRoom((room) => applyPlay(room, data.seat as Seat, card));
  });

  socket.on('game:nextRound', () => {
    withRoom((room) => applyNextRound(room));
  });

  socket.on('room:leave', () => {
    if (!data.roomCode) return;
    const room = getOrCreateRoom(data.roomCode);
    leaveRoom(io, room, socket.id);
    socket.leave(data.roomCode);
    data.roomCode = undefined;
    data.seat = undefined;
  });

  socket.on('disconnect', () => {
    if (!data.roomCode) return;
    const room = getOrCreateRoom(data.roomCode);
    handleDisconnect(io, room, socket.id);
  });

  function withRoom(fn: (room: ReturnType<typeof getOrCreateRoom>) => void) {
    if (!data.roomCode || data.seat === undefined) return;
    const room = getOrCreateRoom(data.roomCode);
    try {
      fn(room);
      touch(room);
      broadcastRoom(io, room);
      scheduleBots(io, room);
    } catch (err) {
      socket.emit('room:error', { message: (err as Error).message });
    }
  }
});

setInterval(cleanupStaleRooms, 30 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`28 game server listening on :${PORT}`);
});
