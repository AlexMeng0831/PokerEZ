# PokerEZ

A beginner-friendly Texas Hold'em app with a standalone poker engine and an in-memory Socket.IO multiplayer server.

[Getting started](#getting-started) · [Multiplayer](packages/multiplayer/README.md) · [Engine](packages/poker-engine/README.md) · [House rules](packages/poker-engine/house-rules.md)

## Getting started

Requires **Node.js 24** and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). This starts both Next.js on port **3000** and the multiplayer server on **3001**. Browser requests and Socket.IO use the same-origin Next.js proxy. No environment variables or external services are required locally.

## Play with a friend

1. Open the app in two different browsers or separate browser profiles. Two ordinary tabs in the same profile share one Guest identity.
2. Create a room in the first browser and share its six-character code.
3. Join in the second browser. With two funded players connected, click **Deal me in**.
4. Play with Fold, Check/Call and custom Bet/Raise, including **MIN** and **ALL IN**.
5. Refresh either browser: its Guest cookie restores the same player and seat.

Rooms support 2–6 players. The server owns game state, validates every action and supplies each player only their authorized view and events. `/preview` remains a solo Mock animation demo; Profile statistics and recent sessions remain sample data.

## Development

| Command                                  | Description                                          |
| ---------------------------------------- | ---------------------------------------------------- |
| `npm run dev`                            | Start frontend and multiplayer server                |
| `npm run dev:web` / `npm run dev:server` | Run either process separately                        |
| `npm run check`                          | Run all tests, typechecks and builds locally |
| `npm run build`                          | Build the frontend and its Engine dependency         |
| `npm start`                              | Start the built frontend and multiplayer server      |
| `npm run engine:test`                    | Run Engine tests and randomized invariants           |
| `npm run server:test`                    | Run real Socket.IO integration tests                 |
| `npm run adapter:test`                   | Test Engine-to-UI presentation mapping               |
| `npm test`                               | Run existing Mock-state tests                        |
| `npm run engine:simulate`                | Run standalone CLI poker examples                    |

Run `npm run check` locally before pushing changes. Automatic GitHub Actions CI is currently disabled.

## Project structure

```text
src/app/                         Play, Table, Learn, Profile and preview
src/lib/multiplayer/             Socket client, view adapter and Motion queue
src/components/poker/animation/  Shared DOM-anchor animation components
packages/poker-engine/           Pure TypeScript rules, tests and CLI
packages/multiplayer/            Guest sessions, rooms, secure dealing and Socket.IO
```

**Frontend:** Next.js, React, TypeScript, Tailwind CSS, Radix/shadcn-style primitives, Zustand, next-themes and Motion for React.

**Engine:** 2–6 player No-Limit Hold'em, full betting rules, best-five evaluation, side pots, refunds, ties and odd chips. It has no runtime dependencies. See the [Engine guide](packages/poker-engine/README.md) and [architecture](packages/poker-engine/docs/architecture.md).

**Multiplayer:** one Node.js process, in-memory rooms, opaque HttpOnly Guest cookies, server-side cryptographic shuffle, revision checks and request deduplication. See [protocol and operations](packages/multiplayer/README.md).

## Current limits

Rooms and sessions are lost when the backend restarts. Disconnected players keep their seats; a 45-second turn timer checks when possible and otherwise folds. Empty rooms expire after two hours; Guest cookies last 24 hours. Mid-hand joins and explicit departures are rejected; returning to an existing seat is allowed.

There are no accounts, database, Redis, tournament formats or ML policy. PokerEZ uses virtual chips only. Production hosting requires HTTPS, correct allowed origins and a proxy to the Node process; it cannot run as a static-only export.
