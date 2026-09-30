// Attack-style tests: each one plays a hostile client against a real server
// on a random port and checks the server refuses. Run with `npm test -w
// packages/server`.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect, type Socket } from 'socket.io-client';
import type { PlayerView } from '@twenty-eight/engine';
import { type ServerConfig, configFromEnv, createGameServer } from '../src/app.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Client extends Socket {
  views: PlayerView[];
  errors: string[];
}

let url = '';
let server: ReturnType<typeof createGameServer>;
let counter = 0;
const code = () => `T${(++counter).toString().padStart(4, '0')}`;
const pid = (label: string) => `${label}-${'x'.repeat(20)}`.slice(0, 40);

const config: ServerConfig = {
  ...configFromEnv({}),
  origins: '*',
  maxConnectionsPerIp: 40,
  roomsPerIpPerWindow: 30,
  eventBurst: 20,
  eventsPerSecond: 5,
  joinTimeoutMs: 1500,
  takeoverGraceMs: 60_000,
};

const open: Client[] = [];
async function client(): Promise<Client> {
  const s = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false }) as Client;
  s.views = [];
  s.errors = [];
  s.on('game:view', (v: PlayerView) => s.views.push(v));
  s.on('room:error', (e: { message: string }) => s.errors.push(e.message));
  open.push(s);
  await new Promise<void>((res, rej) => {
    s.once('connect', () => res());
    s.once('connect_error', rej);
  });
  return s;
}

function once<T>(s: Socket, ev: string, ms = 2000): Promise<T | null> {
  return new Promise((res) => {
    const t = setTimeout(() => res(null), ms);
    s.once(ev, (d: T) => {
      clearTimeout(t);
      res(d);
    });
  });
}

async function join(s: Client, roomCode: string, name: string, playerId: string, create = true) {
  const joined = once<{ seat: number }>(s, 'room:joined');
  s.emit('room:join', { roomCode, name, playerId, create });
  return joined;
}

const last = (s: Client) => s.views[s.views.length - 1];

async function startedGame() {
  const room = code();
  const host = await client();
  const guest = await client();
  await join(host, room, 'Host', pid('host'));
  await join(guest, room, 'Guest', pid('guest'), false);
  guest.emit('room:ready', { ready: true });
  await sleep(100);
  host.emit('room:start', { baseCards: 3 });
  await sleep(300);
  return { room, host, guest };
}

before(async () => {
  server = createGameServer(config);
  const port = await server.listen(0);
  url = `http://127.0.0.1:${port}`;
});

after(async () => {
  for (const s of open) s.close();
  await server.close();
});

describe('seat ownership', () => {
  it('never puts secret player ids in the game view', async () => {
    const { host } = await startedGame();
    const v = last(host);
    assert.ok(v, 'host received a view');
    assert.ok(!JSON.stringify(v).includes(pid('guest')), 'guest secret absent');
    assert.ok(!JSON.stringify(v).includes(pid('host')), 'own secret absent too');
  });

  it('does not hand a dropped seat to someone using the same name', async () => {
    const { room, guest } = await startedGame();
    guest.close();
    await sleep(150);
    const thief = await client();
    const joined = await join(thief, room, 'Guest', pid('thief'), false);
    assert.equal(joined, null);
    assert.ok(thief.errors.some((e) => /already started/.test(e)));
  });

  it('gives the seat back to its owner and drops the stale connection', async () => {
    const { room, guest } = await startedGame();
    const again = await client();
    const joined = await join(again, room, 'Guest', pid('guest'), false);
    assert.equal(joined?.seat, 1);
    await sleep(200);
    assert.equal(guest.connected, false, 'the old socket was disconnected');
  });
});

describe('game actions', () => {
  it('rejects junk bids without touching the game', async () => {
    const { host, guest } = await startedGame();
    const actor = last(host).bidding.turnSeat === 1 ? guest : host;
    for (const value of ['NaN', 14.5, null, { $gt: 0 }, '15']) actor.emit('game:bid', { value });
    await sleep(300);
    const v = last(host);
    assert.equal(v.bidding.currentBid, null);
    assert.ok(actor.errors.some((e) => /valid bid/.test(e)));
  });

  it('refuses a new deal while the round is in play', async () => {
    const { host } = await startedGame();
    const before = JSON.stringify(last(host).hand);
    host.emit('game:nextRound', {});
    await sleep(300);
    assert.equal(JSON.stringify(last(host).hand), before);
    assert.ok(host.errors.some((e) => /not over/.test(e)));
  });

  it('rejects malformed cards', async () => {
    const { host } = await startedGame();
    host.emit('game:play', { card: { suit: 'X', rank: 'Z' } });
    host.emit('game:trump', { card: 'AS' });
    host.emit('game:play', 'garbage');
    await sleep(200);
    assert.ok(host.errors.filter((e) => /valid card/.test(e)).length >= 3);
  });
});

describe('abuse limits', () => {
  it('does not create a room when joining an unknown code', async () => {
    const s = await client();
    const joined = await join(s, code(), 'Guess', pid('guess'), false);
    assert.equal(joined, null);
    assert.ok(s.errors.some((e) => /No room/.test(e)));
  });

  it('rejects bad room codes and missing player ids', async () => {
    const a = await client();
    const b = await client();
    const [ja, jb] = await Promise.all([join(a, '../../etc', 'X', pid('bad')), join(b, code(), 'X', 'short')]);
    assert.equal(ja, null);
    assert.equal(jb, null);
    assert.ok(a.errors.some((e) => /valid room code/.test(e)));
    assert.ok(b.errors.some((e) => /reload/.test(e)));
  });

  it('strips invisible and control characters from names', async () => {
    const room = code();
    const s = await client();
    const states: { seats: { name: string | null }[] }[] = [];
    s.on('room:state', (r) => states.push(r));
    await join(s, room, '‮Host​\u0007  Name', pid('names'));
    await sleep(100);
    assert.equal(states[states.length - 1].seats[0].name, 'Host Name');
  });

  it('disconnects a client that floods events', async () => {
    const s = await client();
    await join(s, code(), 'Flood', pid('flood'));
    let dropped = false;
    s.on('disconnect', () => (dropped = true));
    for (let i = 0; i < 200; i++) s.emit('room:ready', { ready: true });
    await sleep(400);
    assert.equal(dropped, true);
  });

  it('drops oversized messages', async () => {
    const s = await client();
    let dropped = false;
    s.on('disconnect', () => (dropped = true));
    s.emit('room:join', { roomCode: code(), name: 'x'.repeat(50_000), playerId: pid('big'), create: true });
    await sleep(400);
    assert.equal(dropped, true);
  });

  it('disconnects a socket that never joins a room', async () => {
    const s = await client();
    const gone = await once(s, 'disconnect', 3000);
    assert.notEqual(gone, null);
  });

  it('limits how many rooms one address can create', async () => {
    const limited = createGameServer({ ...config, roomsPerIpPerWindow: 3 });
    const port = await limited.listen(0);
    const s = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true, reconnection: false }) as Client;
    s.errors = [];
    s.on('room:error', (e: { message: string }) => s.errors.push(e.message));
    await once(s, 'connect');
    let made = 0;
    for (let i = 0; i < 6; i++) {
      if (await join(s, `LIM${i}`, 'Many', pid(`many${i}`))) made++;
      s.emit('room:leave', {});
      await sleep(20);
    }
    s.close();
    await limited.close();
    assert.equal(made, 3);
    assert.ok(s.errors.some((e) => /Too many new rooms/.test(e)));
  });

  it('caps simultaneous connections from one address', async () => {
    const capped = createGameServer({ ...config, maxConnectionsPerIp: 3 });
    const port = await capped.listen(0);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => {
        const s = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true, reconnection: false });
        return new Promise<{ s: Socket; ok: boolean }>((res) => {
          s.once('connect', () => res({ s, ok: true }));
          s.once('connect_error', () => res({ s, ok: false }));
        });
      })
    );
    for (const r of results) r.s.close();
    await capped.close();
    assert.equal(results.filter((r) => r.ok).length, 3);
  });

  it('cleans up a room once every human has left the lobby', async () => {
    const room = code();
    const s = await client();
    await join(s, room, 'Solo', pid('solo'));
    assert.ok(server.rooms.get(room));
    s.emit('room:leave', {});
    await sleep(100);
    assert.equal(server.rooms.get(room), undefined);
  });
});

describe('HTTP surface', () => {
  it('serves health with hardening headers and nothing else', async () => {
    const health = await fetch(`${url}/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-powered-by'), null);
    const body = (await health.json()) as { ok: boolean };
    assert.equal(body.ok, true);
    const other = await fetch(`${url}/admin`);
    assert.equal(other.status, 404);
  });
});
