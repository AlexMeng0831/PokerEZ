# Engine architecture

[Engine guide](../README.md) · [House rules](../house-rules.md)

## Transition contract

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

This package implements the [documented house rules](../house-rules.md). It has no backend, authentication, transport, persistence, frontend adapter, tournament formats or ML policy. The separate multiplayer package now connects authorized views/events to the Next.js table; `/preview` retains its Mock fixture. The evaluator favors clarity over lookup-table speed; it is suitable for correctness-first local play, not yet benchmarked for large-scale self-play.
