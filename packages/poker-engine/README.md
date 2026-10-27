# PokerEZ poker engine

A standalone TypeScript state machine for 2–6 player No-Limit Texas Hold'em. Runtime code has no dependencies and imports no UI, server, storage or platform-specific modules. Use Node.js 24 for the repository's development tools and CLI.

## Run

From the repository root:

```sh
npm ci
npm run engine:test
npm run engine:typecheck
npm run engine:build
npm run engine:simulate
npm run engine:simulate -- --players 6 --hands 3 --seed 42 --policy calls
```

The default simulator runs a heads-up hand, a six-player side-pot hand, and a three-player example with different main/side winners. It prints public actions, refunds, showdown values and each pot's shares, then checks chip conservation and history replay. `--policy all-in` exercises automatic runout; `--players` accepts 2–6 and `--hands` accepts 1–100. It stops when fewer than two funded players remain. These simple policies are examples, not poker bots.

Run a specific test module with `npm run engine:test -- tests/betting.test.ts`.

## API

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
const started = startHand(table);
if (!started.ok) throw new Error(started.error.message);
const state = started.state;
const legal = getLegalActions(state, state.actorId!);
const result = applyAction(
  state,
  {
    playerId: state.actorId!,
    type: legal.check ? "CHECK" : "CALL",
  },
  state.revision,
);
if (result.ok) {
  const aliceView = getPlayerView(result.state, "alice");
  // Send only an authorized player's view, never result.state.
}
```

| Function                                                        | Contract                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `createTable(players, config?, tableId?)`                       | Create a waiting table; default stack 1,000 and blinds 5/10                                       |
| `startHand(state, deck?)`                                       | Move the button, post capped blinds, deal, and return the first actor or automatic finish         |
| `getLegalActions(state, playerId)`                              | Return check/fold/call, bet/raise ranges, and all-in availability for the current actor           |
| `applyAction(state, action, expectedRevision?)`                 | Validate, commit, and drain any forced street/runout/settlement transitions                       |
| `evaluateHand(cards)`                                           | Best five of 5–7 unique cards, ten categories, rank and lexicographic kicker vector               |
| `compareHands(a, b)`                                            | Return -1, 0 or 1 using category and kickers only                                                 |
| `settlePots(state)`                                             | Settle an explicitly closed, unsettled trusted `SHOWDOWN` snapshot; reject repeat/open settlement |
| `updateTable(state, command)`                                   | Join, leave, sit out/return, or top up between hands                                              |
| `getPlayerView(state, playerId?)`                               | Detached allow-listed private view, or public spectator view without a player ID                  |
| `getPublicEvents(events)` / `getPlayerEvents(events, playerId)` | Detached event streams filtered by visibility/recipient                                           |
| `createHistory(initialTable, state)` / `replayHistory(history)` | Validate and replay a privileged versioned hand archive                                           |

Transition APIs return `{ ok: true, state, events }` or `{ ok: false, state, events: [], error }`. On rejection, `state` is the exact original reference. Successful transitions leave their input untouched. Setup/evaluation/deck helpers throw `RangeError` for invalid helper inputs. `getLegalActions` returns no available actions for a spectator, inactive player or wrong turn.

`BET` and `RAISE_TO` take `{ to }`, the **total on this street**, not added chips. `CALL` can be a partial all-in call. A range's `minTo` is the smallest allowed target; `fullMinTo` is the normal full minimum. When the stack cannot reach it, `minTo === maxTo` is the only short all-in target. The engine never accepts a smaller non-all-in raise, a negative/fractional/unsafe amount, or an all-in raise after that player's rights have closed.

## State and modules

| Module           | Responsibility                                                                    |
| ---------------- | --------------------------------------------------------------------------------- |
| `types`          | Plain serializable state, actions, typed events and results                       |
| `deck`           | Unique deck validation, seeded/Fisher–Yates shuffle, immutable draw               |
| `hand-evaluator` | Enumerate up to 21 five-card combinations; choose a stable best five              |
| `betting`        | Legal actions, commitments, full increment and each player's reopening threshold  |
| `pots`           | Uncalled refunds, contribution layers, eligibility, per-pot winners and odd chips |
| `game`           | Table changes, button/blinds, pending actors, streets, burns and automatic runout |
| `player-view`    | Public/private projections and event recipient filtering                          |
| `history`        | Exact JSON-round-trippable replay from starting state, deck and accepted actions  |

`GameState` is authoritative internal state across hands. Player IDs remain stable if display names change; seat IDs 0–5 determine clockwise order. Every command increments `revision`; every event has a hand ID, revision and per-hand sequence number. `expectedRevision` rejects stale actions, but transport-level retry/idempotency is a future caller responsibility.

Within a hand, each player has remaining `stack`, `streetCommitted`, `totalCommitted`, status, and `reopenAt`. Conservation is:

```text
sum(stack + totalCommitted) = startingChips
```

`pots` is the latest closed-round allocation snapshot; it is **not extra money** to add to contributions. Settlement archives contributions/pot shares in `result`, then clears live commitments. Between hands, leaving or topping up legitimately changes the table's total.

A street tracks `currentBet`, `lastFullRaise`, and a pending-actor set. Posting a blind does not remove a player from that set. Any increase in the bet makes unmatched active opponents pending again; each player's reopening threshold independently decides whether they may raise. A street closes only after required actions and calls resolve. A lone funded player can only answer live all-in chips, so no dry side pot is created.

Forced transitions execute synchronously. `SHOWDOWN` is normally visible in the returned event sequence while the returned state is already `FINISHED`; no animation timing, timers or asynchronous callbacks live here. The separate `settlePots` API is useful for testing/trusted closed snapshots; normal callers do not need a second payout call.

For contributions 500/100/300, first refund the unmatched 200. Contributions become 300/100/300: the first 100 from three players forms a 300 main pot, and the next 200 from two forms a 400 side pot. Each pot selects its own eligible live hands. Odd chips are allocated independently for each tied pot.

`HandValue` compares category and kicker vectors. `bestFive` is selected deterministically, with suit order used only to choose display cards among equal combinations. Wheel has straight-high 5; royal flush is the explicit top category. Board ties and equal kickers remain ties regardless of suits or unused hole cards.

## Privacy, randomness and replay

Internal state and `HandHistory` contain the full deck, burns and private hole cards. Keep both in trusted code. Public events and views use explicit projections; they do not include the seed, deck, burns or internal action history. Private events are recipient-addressed. Showdown and closed all-in runout intentionally reveal live hands; folded hands are excluded. A future server must authenticate the viewer ID before requesting a private view.

For pure, reproducible local simulations, omitted decks use `shuffleSeed + handNo` with a deterministic PRNG. **That default is predictable and is not a secure multiplayer dealer.** A future trusted dealer must inject a securely shuffled complete 52-card deck. `shuffleDeck(deck, random)` also accepts a caller-supplied random function; no random source, callback or class is stored inside state. Replays record the actual deck and therefore reproduce either source exactly.

History version 1 stores a detached initial table snapshot, full deck, and accepted actions with revisions. `createHistory` verifies that replay reproduces the supplied state before returning the archive. Invalid actions are rejected without entering hand history. Presentation timing is deliberately absent.

## Tests and limits

Vitest covers hand strengths/kickers/ties, heads-up and BB option, short blinds, bet/raise targets, player-specific cumulative reopening, partial calls, folded dead money, multi-layer pots, refunds, odd chips, privacy, replay and illegal-action immutability. Fixed-seed fast-check tests generate 250 table/action scenarios (up to three hands each), check every transition, and round-trip histories. Another property checks evaluator order/suit invariance. Failing property runs print their seed and shrink path.

This package implements the [documented house rules](house-rules.md). It has no backend, authentication, transport, persistence, frontend adapter, tournament formats or ML policy. The existing Next.js table still uses mock events. The evaluator favors clarity over lookup-table speed; it is suitable for correctness-first local play, not yet benchmarked for large-scale self-play.
