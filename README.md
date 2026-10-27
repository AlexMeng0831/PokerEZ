# PokerEZ

A beginner-friendly poker interface and a standalone No-Limit Texas Hold'em engine.

[Getting started](#getting-started) · [Engine](packages/poker-engine/README.md) · [Architecture](packages/poker-engine/docs/architecture.md) · [House rules](packages/poker-engine/house-rules.md)

## Getting started

Requires **Node.js 24** and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No environment variables or external services are required.

**Current status:** the engine runs independently. The frontend uses scripted demo hands; engine integration and multiplayer are not implemented yet.

## Features

- **Poker UI** — Play, Table, Learn and Profile, with light/dark themes and portrait mobile layouts.
- **Table animations** — dealing, betting, board reveals, folds, showdown and side-pot transitions, with Reduced Motion support.
- **Poker engine** — 2–6 players, full betting rules, hand evaluation, main/side pots, refunds, split pots and odd chips.
- **Replay and simulation** — typed events, private player views, deterministic hand histories and a CLI simulator.

## Try the engine

```sh
npm run engine:test
npm run engine:simulate
```

The simulator plays complete heads-up and multiplayer hands, prints actions and per-pot payouts, and verifies replay. To configure a session:

```sh
npm run engine:simulate -- --players 6 --hands 3 --seed 42 --policy calls
```

See the [engine guide](packages/poker-engine/README.md) for API examples and supported options.

## Development

| Command                    | Description                       |
| -------------------------- | --------------------------------- |
| `npm run dev`              | Start the frontend                |
| `npm run build`            | Build the frontend for production |
| `npm run typecheck`        | Check frontend types              |
| `npm test`                 | Run frontend mock-state tests     |
| `npm run engine:build`     | Build the standalone engine       |
| `npm run engine:typecheck` | Check engine and test types       |
| `npm run engine:test`      | Build and test the engine         |
| `npm run engine:simulate`  | Run CLI examples                  |

## Project structure

```text
src/app/                         Frontend pages
src/components/poker/animation/  Motion components and mock playback
packages/poker-engine/           Rules, state machine, tests and CLI
```

**Frontend:** Next.js, React, TypeScript, Tailwind CSS, Radix/shadcn-style primitives, Zustand, next-themes and Motion for React.

**Engine:** pure TypeScript with no runtime dependencies. Tested with Vitest and fast-check. It runs without React, a server or a database.

Room codes and profile statistics are demo data. PokerEZ currently uses virtual chips only. Default seeded decks support reproducible local runs; a future multiplayer dealer must provide securely shuffled decks and authenticated access to private views. See [architecture and privacy](packages/poker-engine/docs/architecture.md#privacy-randomness-and-replay).
