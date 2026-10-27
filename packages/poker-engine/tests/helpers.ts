import { expect } from "vitest";
import { applyAction, createTable, startHand } from "../src/game.js";
import type {
  Action,
  Card,
  GameState,
  Rank,
  Suit,
  Transition,
} from "../src/types.js";
export function cards(input: string): Card[] {
  return input
    .split(" ")
    .map((s) => ({
      rank: ("23456789TJQKA".indexOf(s[0]) + 2) as Rank,
      suit: s[1] as Suit,
    }));
}
export function success(result: Transition): GameState {
  if (!result.ok)
    throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
export const table = (stacks = [1000, 1000, 1000]) =>
  createTable(stacks.map((stack, seat) => ({ id: `p${seat}`, seat, stack })));
export const start = (stacks?: number[]) => success(startHand(table(stacks)));
export function act(
  state: GameState,
  type: Action["type"],
  to?: number,
): GameState {
  return success(
    applyAction(state, {
      playerId: state.actorId!,
      type,
      ...(to === undefined ? {} : { to }),
    } as Action),
  );
}
export function checkToFlop(state: GameState): GameState {
  while (state.phase === "PREFLOP") {
    const p = state.players.find((p) => p.id === state.actorId)!;
    state = act(state, p.streetCommitted < state.currentBet ? "CALL" : "CHECK");
  }
  return state;
}
export function expectChips(state: GameState) {
  expect(
    state.players.reduce((sum, p) => sum + p.stack + p.totalCommitted, 0),
  ).toBe(state.startingChips);
  for (const p of state.players) {
    expect(Number.isSafeInteger(p.stack) && p.stack >= 0).toBe(true);
    expect(
      Number.isSafeInteger(p.totalCommitted) &&
        p.totalCommitted >= p.streetCommitted &&
        p.streetCommitted >= 0,
    ).toBe(true);
  }
}
