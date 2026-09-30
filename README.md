# 28

A web app for **28 (Twenty-Eight)**, the card game played across Kerala.

- 32-card deck (7 through Ace), 4 players in 2 partnerships (opposite seats).
- Card ranking/points: J (3) > 9 (2) > A (1) > 10 (1) > K, Q, 8, 7 (0). Total points in the deck: 28.
- Bidding, a concealed trump chosen by the highest bidder, the "call for trump" mechanic when
  a player is void in the suit led, 8 tricks per round, and match play to a target score.

## Play modes

- **Single player** — play against 3 AI bots, entirely in the browser.
- **Online multiplayer** — host a room, share the code with up to 3 friends; any empty seats
  are automatically filled by AI bots so you can play with 1-4 humans.

## Around the table

- **How to play** — the full rule set, house rules included, from the home screen or the `?` button
  at the table.
- **Sound** — synthesised effects (cards, kai sweep, trump call, bids, your turn, round result)
  with a persisted mute toggle; no audio files, so they work offline.
- **Resume** — a solo match is saved after every move; the home screen offers to resume it, and
  your name, difficulty and base-card choice are remembered.
- **Keyboard** — Tab/Enter on every control, `1`–`8` play the matching card, `T` calls for trump,
  and a screen-reader live region announces each event.
- **Version line and updates** — the home screen shows the version, commit and build date. An
  open tab checks for a new build every hour: on the home screen it reloads itself, mid-game it
  offers a Reload button so a hand is never interrupted (a solo game resumes after the reload).
- **Online rooms** — guests tap Ready before the host can start; a dropped player keeps their seat
  for 20 seconds (and can reclaim it any time after, as long as the room lives) before a bot fills
  in; the lobby pre-warms the free-tier server and says so if it is still waking up.

## Security

The server treats every client as potentially hostile, including scripted or AI-driven ones:

- **Hidden information stays hidden.** Each player only ever receives their own hand; the
  set-aside trump is sent only to its owner until exposed; logs never name private cards; and
  cards are dealt with the Web Crypto generator, not `Math.random` (whose state can be
  reconstructed from enough observed deals).
- **The server is the referee.** Every action is re-checked by the engine for turn, phase and
  legality; payloads are validated and normalised before use, so junk values and client-supplied
  objects never reach the game state or other players.
- **Seats belong to their owner.** A dropped seat can only be reclaimed with that browser's
  secret player id (never shown to anyone); names prove nothing. A reclaim drops the stale
  connection so one seat is never driven twice.
- **Abuse limits.** 8 KB message cap; a token-bucket rate limit per connection (a flood
  disconnects it); a cap on connections and on new rooms per address; joining an unknown code
  never creates a room; idle sockets and abandoned rooms are cleaned up, and bots stop playing
  when no human is connected.
- **Hardened surfaces.** The site ships a strict Content Security Policy (scripts only from the
  site, network only to itself and the game server); the server sends `nosniff`, `DENY` framing
  and `no-referrer` headers and only allows the site's own origins by CORS
  (`CLIENT_ORIGIN` overrides the default list).
- **Supply chain.** CI runs with read-only permissions, installs without lifecycle scripts,
  audits production dependencies, and runs `packages/server/test/security.test.ts`, which
  replays each attack against a live server. Dependabot proposes weekly updates.

Limits can be tuned with environment variables on the server (`MAX_CONNECTIONS_PER_IP`,
`ROOMS_PER_IP`, `EVENTS_PER_SECOND`, `MAX_ROOMS`, ...; see `packages/server/src/app.ts`).

## Deploying the server

The web app is built from `main` by GitHub Pages; the Socket.IO server is hosted on Render from
`render.yaml`. The two must be deployed together: an older server silently ignores messages it
does not understand (for example a trump chosen as a card rather than a suit) and the game then
plays by the wrong rules. Every client checks the server's protocol version on joining a room and
shows a red banner if they differ. To check what the server is running open `/health` on it
(`{"ok":true,"protocol":4,"commit":"abc1234"}`); to update it, trigger **Manual Deploy → Deploy
latest commit** in the Render dashboard if auto-deploy is off.

## Project layout

This is an npm workspaces monorepo:

- `packages/engine` — the game rules engine (deck, bidding, trump, trick resolution, scoring,
  bot AI) shared by both the client and the server. Pure TypeScript, no UI or networking.
- `packages/web` — the React (Vite) frontend. Single-player mode runs the engine directly in
  the browser; online mode talks to the server over Socket.IO.
- `packages/server` — the Node/Express/Socket.IO server that hosts online multiplayer rooms,
  using the same engine as the authoritative source of truth.

## Running locally

```bash
npm install

# terminal 1: realtime server (needed for online multiplayer only)
npm run dev:server

# terminal 2: web app
npm run dev:web
```

Then open the web app (Vite prints the local URL, typically http://localhost:5173).
Single-player mode works without the server running. Online mode expects the server at
`http://localhost:4000` by default — override with `VITE_SERVER_URL` in `packages/web/.env`.

## Bot AI

Three difficulty levels share one heuristic policy (`packages/engine/src/policy.ts`) and differ
in how much they know and how carefully they bid:

- **Rookie** overbids, ignores its partner and plays a random legal card about a fifth of the time.
- **Regular** bids from a hand evaluation calibrated by simulation against the points a declaring
  team actually captures, and feeds point cards to a partner who is safely winning a kai.
- **Expert** also remembers every card played and which seats are void in a suit
  (`tracking.ts`), leads boss cards, draws trumps as declarer, and from any point in the round
  runs a determinized Monte Carlo search (`simulate.ts`): it deals the unseen cards out to the
  other seats in many ways consistent with what it knows and plays each candidate card out.

```bash
npm run bench -w packages/engine        # expert vs regular, regular vs rookie, expert vs rookie
```

## Tests and checks

```bash
npm run test:engine   # unit tests, then the 200-match self-test
npm run ci            # everything the CI workflow runs: build, typecheck, lint, tests
```

- `packages/engine/test/*.test.ts` are rule-level unit tests (bidding rounds, the set-aside
  trump, calling for trump, early round end, stakes, base cards, kunukku) built on
  `node:test` and run through `tsx`.
- `packages/engine/src/selftest.ts` simulates 200 full matches with 4 AI bots end-to-end and
  checks the rules invariants hold (28 points captured per round, no duplicate cards, base
  cards conserved, clips only shed by the declaring team, etc.).

The `CI` GitHub Actions workflow runs the same checks on every pull request and on pushes to
non-main branches; `Deploy to GitHub Pages` publishes `main`.
