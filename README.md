# 28

A web app for **28 (Twenty-Eight)**, the trick-taking card game played across Kerala.

- 32-card deck (7 through Ace), 4 players in 2 partnerships (opposite seats).
- Card ranking/points: J (3) > 9 (2) > A (1) > 10 (1) > K, Q, 8, 7 (0). Total points in the deck: 28.
- Bidding, a concealed trump chosen by the highest bidder, the "call for trump" mechanic when
  a player is void in the suit led, 8 tricks per round, and match play to a target score.

## Play modes

- **Single player** — play against 3 AI bots, entirely in the browser.
- **Online multiplayer** — host a room, share the code with up to 3 friends; any empty seats
  are automatically filled by AI bots so you can play with 1-4 humans.

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

## Engine self-test

```bash
npm run test:engine
```

Simulates 200 full games with 4 AI bots end-to-end and checks the rules invariants hold
(28 points captured per round, no duplicate cards, hands empty at round end, etc.).
