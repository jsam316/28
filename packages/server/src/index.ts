import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import type { Card, Seat, Suit } from '@twenty-eight/engine';
import { cleanupStaleRooms, findOpenSeat, getOrCreateRoom, touch } from './rooms.js';
import {
  applyBid,
  applyDouble,
  applyNextRound,
  applyPlay,
  applyRedouble,
  applyReveal,
  applyTrump,
  broadcastRoom,
  handleDisconnect,
  joinRoom,
  reconnectRoom,
  scheduleBots,
  startGame,
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

  socket.on('room:join', ({ roomCode, name }: { roomCode: string; name: string }) => {
    try {
      const code = roomCode.trim().toUpperCase();
      const cleanName = (name || 'Player').trim().slice(0, 20) || 'Player';
      const room = getOrCreateRoom(code);

      const existing = room.slots.find(
        (s) => s && !s.connected && !s.isBot && s.name.toLowerCase() === cleanName.toLowerCase()
      );

      let seat: Seat;
      if (existing) {
        seat = existing.seat;
        reconnectRoom(room, seat, socket.id);
      } else {
        const open = findOpenSeat(room);
        if (open === null) {
          socket.emit('room:error', { message: 'Room is full.' });
          return;
        }
        seat = open;
        joinRoom(room, seat, cleanName, socket.id);
      }

      data.roomCode = code;
      data.seat = seat;
      socket.join(code);
      socket.emit('room:joined', { roomCode: code, seat });
      broadcastRoom(io, room);
    } catch (err) {
      socket.emit('room:error', { message: (err as Error).message });
    }
  });

  socket.on('room:start', ({ baseCards }: { baseCards?: number }) => {
    if (!data.roomCode) return;
    const room = getOrCreateRoom(data.roomCode);
    try {
      startGame(io, room, baseCards ?? 6);
    } catch (err) {
      socket.emit('room:error', { message: (err as Error).message });
    }
  });

  socket.on('game:bid', ({ value }: { value: 'pass' | number }) => {
    withRoom((room) => applyBid(room, data.seat as Seat, value));
  });

  socket.on('game:trump', ({ suit }: { suit: Suit }) => {
    withRoom((room) => applyTrump(room, data.seat as Seat, suit));
  });

  socket.on('game:double', ({ accept }: { accept: boolean }) => {
    withRoom((room) => applyDouble(room, data.seat as Seat, Boolean(accept)));
  });

  socket.on('game:redouble', ({ accept }: { accept: boolean }) => {
    withRoom((room) => applyRedouble(room, data.seat as Seat, Boolean(accept)));
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
