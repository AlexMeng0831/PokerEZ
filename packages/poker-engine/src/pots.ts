import { clockwise, failure, livePlayers } from "./betting.js";
import { emitPublic } from "./events.js";
import { compareHands, evaluateHand } from "./hand-evaluator.js";
import type {
  GameEvent,
  GameState,
  Pot,
  PotResult,
  Transition,
} from "./types.js";
export function buildPots(state: GameState): Pot[] {
  const levels = [
    ...new Set(state.players.map((p) => p.totalCommitted).filter((n) => n > 0)),
  ].sort((a, b) => a - b);
  let previous = 0;
  return levels.map((cap, i) => {
    const contributors = state.players.filter((p) => p.totalCommitted >= cap);
    const amount = (cap - previous) * contributors.length;
    previous = cap;
    return {
      id: `${state.handId}:pot:${i}`,
      cap,
      amount,
      contributors: contributors.map((p) => p.id),
      eligible: contributors
        .filter((p) => p.status === "ACTIVE" || p.status === "ALL_IN")
        .map((p) => p.id),
    };
  });
}
/** Close each street by returning its sole unmatched upper tail, including blinds. */
export function refundUncalled(state: GameState, events: GameEvent[]): void {
  const sorted = [...state.players].sort(
    (a, b) => b.streetCommitted - a.streetCommitted,
  );
  const player = sorted[0];
  const excess = player.streetCommitted - (sorted[1]?.streetCommitted ?? 0);
  if (excess <= 0) return;
  player.streetCommitted -= excess;
  player.totalCommitted -= excess;
  player.stack += excess;
  if (player.status === "ALL_IN" && player.stack > 0) player.status = "ACTIVE";
  emitPublic(state, events, {
    type: "UNCALLED_RETURNED",
    playerId: player.id,
    amount: excess,
  });
}
/** The internal settlement is invoked only at a closed round / uncontested finish. */
export function settleWorking(state: GameState, events: GameEvent[]): void {
  refundUncalled(state, events);
  const live = livePlayers(state);
  const uncontested = live.length === 1;
  const hands = uncontested
    ? []
    : live.map((p) => ({
        playerId: p.id,
        value: evaluateHand([...p.holeCards, ...state.board]),
      }));
  if (!uncontested) {
    state.phase = "SHOWDOWN";
    emitPublic(state, events, { type: "STREET_STARTED", phase: "SHOWDOWN" });
    for (const p of live) p.revealed = true;
    emitPublic(state, events, {
      type: "SHOWDOWN",
      hands: hands.map((h) => ({
        ...h,
        cards: state.players
          .find((p) => p.id === h.playerId)!
          .holeCards.map((c) => ({ ...c })),
      })),
    });
  }
  const pots = buildPots(state);
  const results: PotResult[] = pots.map((pot) => {
    // Uncontested pots can include folded dead money above the survivor's cap.
    const candidates = uncontested
      ? live
      : live.filter((p) => pot.eligible.includes(p.id));
    if (!candidates.length)
      throw new Error("Pot has no eligible winner: invalid internal state");
    let winners = [candidates[0]];
    if (!uncontested)
      for (const p of candidates.slice(1)) {
        const comparison = compareHands(
          hands.find((h) => h.playerId === p.id)!.value,
          hands.find((h) => h.playerId === winners[0].id)!.value,
        );
        if (comparison > 0) winners = [p];
        else if (comparison === 0) winners.push(p);
      }
    winners = clockwise(winners, state.buttonSeat!);
    const base = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount % winners.length;
    const shares = winners.map((p, i) => ({
      playerId: p.id,
      amount: base + (i < remainder ? 1 : 0),
    }));
    for (const share of shares)
      state.players.find((p) => p.id === share.playerId)!.stack += share.amount;
    return {
      ...pot,
      eligible: candidates.map((p) => p.id),
      winners: winners.map((p) => p.id),
      shares,
    };
  });
  state.result = {
    reason: uncontested ? "UNCONTESTED" : "SHOWDOWN",
    pots: results,
    hands,
    contributions: state.players.map((p) => ({
      playerId: p.id,
      amount: p.totalCommitted,
    })),
  };
  for (const pot of results)
    emitPublic(state, events, { type: "POT_AWARDED", pot });
  for (const p of state.players) {
    p.totalCommitted = 0;
    p.streetCommitted = 0;
  }
  state.pots = [];
  state.pending = [];
  state.actorId = null;
  state.currentBet = 0;
  state.phase = "FINISHED";
  emitPublic(state, events, { type: "HAND_FINISHED", result: state.result });
}
export function settlePots(state: GameState): Transition {
  if (
    state.phase !== "SHOWDOWN" ||
    state.result ||
    state.pending.length ||
    state.actorId !== null ||
    livePlayers(state).length < 1 ||
    (livePlayers(state).length > 1 && state.board.length !== 5)
  )
    return failure(
      state,
      "NOT_SETTLEABLE",
      "Only an unsettled closed showdown can be settled",
    );
  const next = structuredClone(state);
  next.revision++;
  const events: GameEvent[] = [];
  settleWorking(next, events);
  return { ok: true, state: next, events };
}
