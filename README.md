# PokerEZ

A beginner-friendly Texas Hold'em project with a Next.js frontend and an independent TypeScript poker engine. The frontend currently runs scripted demo hands; the engine is tested separately and has not been connected to the UI.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No accounts, environment variables or external services are required for local development.

## Engine

```sh
npm run engine:test
npm run engine:typecheck
npm run engine:build
npm run engine:simulate
```

The simulator runs complete heads-up and multiplayer hands, prints actions and per-pot settlement, and verifies chip conservation and deterministic replay. For a configurable run:

```sh
npm run engine:simulate -- --players 6 --hands 3 --seed 42 --policy calls
```

Use `--policy all-in` to exercise automatic runout. Run an individual test module with `npm run engine:test -- tests/betting.test.ts`.

The engine supports 2–6 players, integer play chips, fixed blinds, all streets, full/short raises, player-specific reopening, main/side pots, refunds, splits and odd chips. It returns immutable state transitions and typed events. Public/player views are projected separately from internal state and privileged replay history.

See the [engine guide](packages/poker-engine/README.md) for APIs and state design, and [house rules](packages/poker-engine/house-rules.md) for PokerEZ's casual-table choices and rule references.

## Project structure

```text
src/app/                         Play, Table, Learn, Profile and preview pages
src/components/poker/animation/  Motion components, DOM anchors and mock playback
src/lib/animation/mock-game.ts   Frontend-only event fixture and UI rehearsal
packages/poker-engine/src/       Pure TypeScript rules and state machine
packages/poker-engine/tests/     Vitest cases and fast-check invariants
packages/poker-engine/examples/  CLI simulator
```

The engine uses small modules for `types`, `deck`, `hand-evaluator`, `betting`, `pots`, `game`, `player-view` and `history`. It has no runtime dependency on React, Zustand, a server, or storage.

## Frontend

| Route      | Purpose                                                       |
| ---------- | ------------------------------------------------------------- |
| `/`        | Create/join a demo room or try a hand                         |
| `/table`   | Interactive mock table with betting controls and focused view |
| `/learn`   | Rules, hand rankings and basics                               |
| `/profile` | Guest profile and clearly labeled sample statistics           |
| `/preview` | Mock-event animation lab, including side-pot splitting        |

The frontend uses Next.js App Router, React, TypeScript, Tailwind CSS, Radix/shadcn-style primitives, Zustand, next-themes and Motion for React. It supports light/dark themes, portrait layouts and Reduced Motion.

Play/Next in the animation lab, or dealing at the table, opens a focused view. Exit focus or Esc restores scrolling. Best-hand labels sit by the player; useful cards receive an outline without lifting; visible folded demo hands remain dimmed. The preview's side pots and outcomes are authored fixtures.

Display name, theme and demo room metadata are stored in this browser. Room codes do not connect players, Profile history is demo data, and frontend table state resets on reload.

## Checks

| Command                    | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `npm test`                 | Frontend mock-state tests                               |
| `npm run typecheck`        | Frontend TypeScript check                               |
| `npm run build`            | Next.js production build                                |
| `npm run engine:test`      | Build engine, then run Vitest and randomized invariants |
| `npm run engine:typecheck` | Type-check engine sources and tests                     |
| `npm run engine:build`     | Emit standalone ESM JavaScript and type declarations    |
| `npm run engine:simulate`  | Run CLI examples                                        |

## Current boundaries

There is no backend, multiplayer transport, database, authentication, frontend engine adapter, or ML policy. PokerEZ uses virtual chips and has no real-money functionality.

The engine's default seeded shuffle is intentionally predictable for local testing and self-play. A future trusted multiplayer dealer must provide a securely shuffled deck and authenticate access to private views. Full engine state and replay archives contain hidden cards and must stay in trusted code.

The hand evaluator enumerates at most 21 five-card combinations for clarity. Large-scale self-play performance has not been benchmarked. Supported table choices and excluded variants are documented in the house rules.
