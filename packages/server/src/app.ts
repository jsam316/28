import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server, type Socket } from 'socket.io';
import { PROTOCOL_VERSION, type Seat } from '@twenty-eight/engine';
import { RoomStore, findOpenSeat, touch } from './rooms.js';
import { Counter, SlidingWindow, TokenBucket } from './limits.js';
import {
  asObject,
  parseBaseCards,
  parseBid,
  parseCard,
  parsePlayerId,
  parseRoomCode,
  sanitizeName,
} from './validate.js';
import {
  type ManagerOptions,
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

export interface ServerConfig {
  // Allowed browser origins for CORS ('*' for any).
  origins: string | string[];
  // Behind a reverse proxy (Render): take the client IP from X-Forwarded-For.
  trustProxy: boolean;
  commit: string;
  maxPayloadBytes: number;
  maxConnectionsPerIp: number;
  maxRooms: number;
  roomsPerIpPerWindow: number;
  roomWindowMs: number;
  eventBurst: number;
  eventsPerSecond: number;
  joinTimeoutMs: number;
  takeoverGraceMs: number;
  idleRoomMs: number;
  staleRoomMs: number;
  cleanupIntervalMs: number;
}

// The site is served from these origins; anything else (another website
// trying to drive visitors' browsers at the server) is refused by CORS.
export const DEFAULT_ORIGINS = [
  'https://www.28-game.com',
  'https://28-game.com',
  'https://jsam316.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const num = (name: string, fallback: number) => {
    const v = Number(env[name]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    origins: env.CLIENT_ORIGIN
      ? env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
      : DEFAULT_ORIGINS,
    // Render sets RENDER=true and sits in front of the app as a proxy.
    trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY === 'true' : env.RENDER === 'true',
    commit: (env.RENDER_GIT_COMMIT ?? env.GIT_COMMIT ?? 'unknown').slice(0, 7),
    maxPayloadBytes: num('MAX_PAYLOAD_BYTES', 8 * 1024),
    maxConnectionsPerIp: num('MAX_CONNECTIONS_PER_IP', 12),
    maxRooms: num('MAX_ROOMS', 500),
    roomsPerIpPerWindow: num('ROOMS_PER_IP', 6),
    roomWindowMs: num('ROOM_WINDOW_MS', 10 * 60 * 1000),
    eventBurst: num('EVENT_BURST', 20),
    eventsPerSecond: num('EVENTS_PER_SECOND', 5),
    joinTimeoutMs: num('JOIN_TIMEOUT_MS', 30 * 1000),
    takeoverGraceMs: num('TAKEOVER_GRACE_MS', 20 * 1000),
    idleRoomMs: num('IDLE_ROOM_MS', 15 * 60 * 1000),
    staleRoomMs: num('STALE_ROOM_MS', 3 * 60 * 60 * 1000),
    cleanupIntervalMs: num('CLEANUP_INTERVAL_MS', 5 * 60 * 1000),
  };
}

interface SocketData {
  roomCode?: string;
  seat?: Seat;
}

export function createGameServer(config: ServerConfig) {
  const rooms = new RoomStore();
  const connectionsPerIp = new Counter();
  const roomCreations = new SlidingWindow(config.roomsPerIpPerWindow, config.roomWindowMs);
  const managerOpts: ManagerOptions = { takeoverGraceMs: config.takeoverGraceMs };

  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    next();
  });
  app.use(cors({ origin: config.origins }));
  app.get('/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, protocol: PROTOCOL_VERSION, commit: config.commit });
  });
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: config.origins, methods: ['GET', 'POST'] },
    serveClient: false,
    // Real messages are a few hundred bytes; anything big is an attack.
    maxHttpBufferSize: config.maxPayloadBytes,
    connectTimeout: 15_000,
  });

  function clientIp(socket: Socket): string {
    const xff = socket.handshake.headers['x-forwarded-for'];
    if (config.trustProxy && typeof xff === 'string' && xff.length > 0) {
      // The proxy appends the address it saw; anything before it is
      // client-supplied and could be forged, so take the last entry.
      const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1];
    }
    return socket.handshake.address;
  }

  // Cap simultaneous connections from one address before the socket is set up.
  io.use((socket, next) => {
    const ip = clientIp(socket);
    if (connectionsPerIp.get(ip) >= config.maxConnectionsPerIp) {
      next(new Error('Too many connections from your network. Close some tabs and try again.'));
      return;
    }
    connectionsPerIp.add(ip);
    (socket.data as { ip?: string }).ip = ip;
    next();
  });

  io.on('connection', (socket) => {
    const ip = (socket.data as { ip?: string }).ip ?? clientIp(socket);
    const data: SocketData = {};
    const bucket = new TokenBucket(config.eventBurst, config.eventsPerSecond);

    // A socket that never joins a room is just holding a connection open.
    const joinTimer = setTimeout(() => {
      if (!data.roomCode) socket.disconnect(true);
    }, config.joinTimeoutMs);

    // Every incoming event costs a token; a flood disconnects the socket.
    socket.use((_packet, next) => {
      if (bucket.take()) {
        next();
        return;
      }
      socket.emit('room:error', { message: 'Too many requests — slow down.' });
      socket.disconnect(true);
    });

    const fail = (message: string) => socket.emit('room:error', { message });

    socket.on('room:join', (raw: unknown) => {
      try {
        const payload = asObject(raw);
        const code = parseRoomCode(payload.roomCode);
        if (!code) return fail('That is not a valid room code.');
        const playerId = parsePlayerId(payload.playerId);
        if (!playerId) return fail('Please reload the page and try again.');
        const name = sanitizeName(payload.name);
        const wantsCreate = payload.create === true;

        // Already in a room on this socket: leave it first.
        if (data.roomCode && data.roomCode !== code) {
          const old = rooms.get(data.roomCode);
          if (old && leaveRoom(io, old, socket.id, managerOpts)) rooms.delete(old);
          socket.leave(data.roomCode);
          data.roomCode = undefined;
          data.seat = undefined;
        }

        let room = rooms.get(code);
        if (!room) {
          if (!wantsCreate) return fail('No room with that code. Check it with the host.');
          if (rooms.size >= config.maxRooms) return fail('The server is busy. Please try again in a few minutes.');
          if (!roomCreations.tryHit(ip)) return fail('Too many new rooms from your network. Please wait a few minutes.');
          room = rooms.create(code);
        }

        const returning = findReturningSeat(room, playerId);
        let seat: Seat;
        if (returning) {
          seat = returning.seat;
          const previousSocket = reconnectRoom(room, seat, socket.id);
          if (previousSocket) io.sockets.sockets.get(previousSocket)?.disconnect(true);
        } else {
          if (room.state && room.state.phase !== 'game_end') return fail('That game has already started.');
          const open = findOpenSeat(room);
          if (open === null) return fail('Room is full.');
          seat = open;
          joinRoom(room, seat, name, socket.id, playerId);
        }

        clearTimeout(joinTimer);
        data.roomCode = code;
        data.seat = seat;
        socket.join(code);
        socket.emit('room:joined', { roomCode: code, seat, protocol: PROTOCOL_VERSION, commit: config.commit });
        broadcastRoom(io, room);
        // A returning human takes back a seat a bot may have been playing.
        scheduleBots(io, room);
      } catch (err) {
        fail((err as Error).message);
      }
    });

    socket.on('room:ready', (raw: unknown) => {
      const room = currentRoom();
      if (!room || data.seat === undefined) return;
      setReady(room, data.seat, asObject(raw).ready !== false);
      broadcastRoom(io, room);
    });

    socket.on('room:start', (raw: unknown) => {
      const room = currentRoom();
      if (!room) return;
      try {
        if (data.seat !== 0) throw new Error('Only the host can start the game.');
        if (room.state && room.state.phase !== 'game_end') throw new Error('The game has already started.');
        const waiting = unreadyPlayers(room);
        if (waiting.length > 0) {
          throw new Error(`Waiting for ${waiting.map((p) => p.name).join(', ')} to be ready.`);
        }
        startGame(io, room, parseBaseCards(asObject(raw).baseCards));
      } catch (err) {
        fail((err as Error).message);
      }
    });

    socket.on('game:bid', (raw: unknown) => {
      const value = parseBid(asObject(raw).value);
      if (value === null) return fail('That is not a valid bid.');
      withRoom((room, seat) => applyBid(room, seat, value));
    });

    socket.on('game:redeal', () => {
      withRoom((room, seat) => applyRedeal(room, seat));
    });

    socket.on('game:trump', (raw: unknown) => {
      const card = parseCard(asObject(raw).card);
      if (!card) return fail('That is not a valid card.');
      withRoom((room, seat) => applyTrump(room, seat, card));
    });

    socket.on('game:revealTrump', () => {
      withRoom((room, seat) => applyReveal(room, seat));
    });

    socket.on('game:play', (raw: unknown) => {
      const card = parseCard(asObject(raw).card);
      if (!card) return fail('That is not a valid card.');
      withRoom((room, seat) => applyPlay(room, seat, card));
    });

    socket.on('game:nextRound', () => {
      withRoom((room) => applyNextRound(room));
    });

    socket.on('room:leave', () => {
      const room = currentRoom();
      if (!room || !data.roomCode) return;
      if (leaveRoom(io, room, socket.id, managerOpts)) rooms.delete(room);
      socket.leave(data.roomCode);
      data.roomCode = undefined;
      data.seat = undefined;
    });

    socket.on('disconnect', () => {
      clearTimeout(joinTimer);
      connectionsPerIp.remove(ip);
      const room = currentRoom();
      if (room && handleDisconnect(io, room, socket.id, managerOpts)) rooms.delete(room);
    });

    function currentRoom() {
      return data.roomCode ? rooms.get(data.roomCode) : undefined;
    }

    // Run a game action for the seat this socket actually holds. The seat
    // comes from the server's own record of the join, never from the client.
    function withRoom(fn: (room: NonNullable<ReturnType<typeof currentRoom>>, seat: Seat) => void) {
      const room = currentRoom();
      if (!room || data.seat === undefined) return;
      const slot = room.slots[data.seat];
      if (!slot || slot.socketId !== socket.id) return;
      try {
        fn(room, data.seat);
        touch(room);
        broadcastRoom(io, room);
        scheduleBots(io, room);
      } catch (err) {
        fail((err as Error).message);
      }
    }
  });

  const cleanupTimer = setInterval(() => {
    rooms.cleanup(config.idleRoomMs, config.staleRoomMs);
    roomCreations.prune();
  }, config.cleanupIntervalMs);
  cleanupTimer.unref();

  return {
    httpServer,
    io,
    rooms,
    listen(port: number): Promise<number> {
      return new Promise((resolve) => {
        httpServer.listen(port, () => {
          const addr = httpServer.address();
          resolve(typeof addr === 'object' && addr ? addr.port : port);
        });
      });
    },
    async close(): Promise<void> {
      clearInterval(cleanupTimer);
      for (const room of [...rooms.all()]) rooms.delete(room);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
