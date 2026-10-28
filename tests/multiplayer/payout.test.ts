import { expect, it } from "vitest";
import { presentPayout } from "../../src/lib/multiplayer/payout-presentation";
import { fromSnapshot } from "../../src/lib/multiplayer/adapter";
import {
  createTable,
  getPlayerView,
  type PotResult,
} from "@pokerez/poker-engine";

it("removes each paid pot while retaining separate winners, split shares and chip totals", () => {
  const game = createTable([
    { id: "a", seat: 0 },
    { id: "b", seat: 1 },
    { id: "c", seat: 2 },
  ]);
  const main: PotResult = {
    id: "main",
    cap: 100,
    amount: 301,
    contributors: ["a", "b", "c"],
    eligible: ["a", "b", "c"],
    winners: ["b"],
    shares: [{ playerId: "b", amount: 301 }],
  };
  const side: PotResult = {
    id: "side",
    cap: 300,
    amount: 401,
    contributors: ["a", "c"],
    eligible: ["a", "c"],
    winners: ["a", "c"],
    shares: [
      { playerId: "a", amount: 201 },
      { playerId: "c", amount: 200 },
    ],
  };
  const view = getPlayerView(game, "a");
  view.pots = [main, side];
  view.totalPot = 702;
  const state = fromSnapshot({
    room: {
      code: "TEST12",
      name: "Test",
      capacity: 6,
      smallBlind: 1,
      bigBlind: 2,
    },
    view,
    playerId: "a",
    events: [],
    version: 1,
    connected: [],
    turnDeadline: null,
    resume: false,
  });
  const original = structuredClone(state);
  const first = presentPayout(state, main);
  expect(first.pot).toBe(401);
  expect(first.pots.map((p) => p.id)).toEqual(["side"]);
  expect(first.awards).toEqual({ b: 301 });
  const last = presentPayout(first, side);
  expect(last.pot).toBe(0);
  expect(last.pots).toEqual([]);
  expect(last.awards).toEqual({ b: 301, a: 201, c: 200 });
  expect(new Set(last.winners)).toEqual(new Set(["a", "b", "c"]));
  expect(last.players.reduce((sum, p) => sum + p.stack, 0)).toBe(
    state.players.reduce((sum, p) => sum + p.stack, 0) + 702,
  );
  expect(state).toEqual(original);
});
