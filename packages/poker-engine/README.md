# PokerEZ Engine

A pure TypeScript state machine for 2–6 player No-Limit Texas Hold'em. Integer play chips, fixed blinds, and no runtime dependencies.

[Usage](#usage) · [API](#api) · [Architecture](docs/architecture.md) · [House rules](house-rules.md)

## Run

From the repository root, using Node.js 24:

```sh
npm ci
npm run engine:test
npm run engine:simulate
```

The default simulator runs heads-up, six-player side pots, and a hand with different main/side winners. Each run prints actions, refunds, showdown values and payouts, then verifies chip conservation and replay.

```sh
npm run engine:simulate -- --players 6 --hands 3 --seed 42 --policy calls
```

Options: `--players` 2–6, `--hands` 1–100, `--seed` 0–4294967295, and `--policy calls|all-in`. A session stops when fewer than two funded players remain.

## Usage

Build with `npm run engine:build`, then import the workspace package:

```ts
import {
  createTable,
  startHand,
  getLegalActions,
  applyAction,
  getPlayerView,
} from "@pokerez/poker-engine";

const table = createTable([
  { id: "alice", seat: 0 },
  { id: "bob", seat: 3 },
]);

const opened = startHand(table);
if (!opened.ok) throw new Error(opened.error.message);

const { state } = opened;
const legal = getLegalActions(state, state.actorId!);
const next = applyAction(state, {
  playerId: state.actorId!,
  type: legal.check ? "CHECK" : "CALL",
});
if (!next.ok) throw new Error(next.error.message);

const view = getPlayerView(next.state, "alice");
```

Transitions return `{ ok, state, events }`. Successful calls leave the input untouched; rejected calls return the original state and a typed error. `BET.to` and `RAISE_TO.to` are cumulative targets for the current street. `CALL` and `ALL_IN` amounts are computed by the engine.

## API

| Function                              | Purpose                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| `createTable`                         | Create a waiting table; defaults to 1,000 chips and 5/10 blinds |
| `startHand`                           | Rotate button/blinds, deal, and select the first actor          |
| `getLegalActions`                     | Return legal calls, bet/raise ranges and all-in availability    |
| `applyAction`                         | Validate an action and advance the hand                         |
| `evaluateHand` / `compareHands`       | Select the best five cards and compare category/kickers         |
| `settlePots`                          | Settle a trusted, closed showdown snapshot                      |
| `updateTable`                         | Join, leave, sit out or top up between hands                    |
| `getPlayerView`                       | Build a public or player-specific view                          |
| `getPublicEvents` / `getPlayerEvents` | Filter events by visibility and recipient                       |
| `createHistory` / `replayHistory`     | Record and reproduce a hand                                     |

Normal actions settle completed hands automatically; a separate `settlePots` call is unnecessary. See [architecture](docs/architecture.md) for state fields, raise reopening, contribution layers and replay contracts.

## Verification

```sh
npm run engine:test
npm run engine:typecheck
npm run engine:test -- tests/betting.test.ts
```

Vitest covers heads-up order, BB action, kickers/ties, short all-ins, reopening, side pots, refunds, odd chips, privacy and invalid-action immutability. Fixed-seed fast-check scenarios check chip conservation, unique cards and replay across complete hands. CLI tests run the compiled package.

## Integration boundaries

Full `GameState` and history archives contain hidden cards. Only authorized player views and filtered events should cross a client boundary. Default seeded decks are predictable and intended for local testing; a multiplayer dealer must inject a securely shuffled complete deck.

Transport and Guest sessions live in the separate [multiplayer package](../multiplayer/README.md). This Engine package contains no transport, authentication, storage, animation timing or ML policy. Supported table choices and excluded variants are defined in [house rules](house-rules.md).
