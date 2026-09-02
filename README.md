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

## Around the table

- **How to play** — the full rule set, house rules included, from the home screen or the `?` button
  at the table.
- **Sound** — synthesised effects (cards, kai sweep, trump call, bids, your turn, round result)
  with a persisted mute toggle; no audio files, so they work offline.
- **Resume** — a solo match is saved after every move; the home screen offers to resume it, and
  your name, difficulty and base-card choice are remembered.
- **Keyboard** — Tab/Enter on every control, `1`–`8` play the matching card, `T` calls for trump,
  and a screen-reader live region announces each event.
- **Online rooms** — guests tap Ready before the host can start; a dropped player keeps their seat
  for 20 seconds (and can reclaim it any time after, as long as the room lives) before a bot fills
  in; the lobby pre-warms the free-tier server and says so if it is still waking up.

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
