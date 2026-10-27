import { describe, expect, it } from "vitest";
import { getLegalActions } from "../src/betting.js";
import { createDeck } from "../src/deck.js";
import {
  applyAction,
  createTable,
  startHand,
  updateTable,
} from "../src/game.js";
import {
  act,
  checkToFlop,
  expectChips,
  start,
  success,
  table,
} from "./helpers.js";
describe("hand lifecycle", () => {
  it("uses heads-up button/SB, deals BB first, and preserves the BB option", () => {
    const deck = createDeck();
    let s = success(startHand(table([1000, 1000]), deck));
    expect([s.buttonSeat, s.smallBlindSeat, s.bigBlindSeat, s.actorId]).toEqual(
      [0, 0, 1, "p0"],
    );
    expect(s.players[1].holeCards).toEqual([deck[0], deck[2]]);
    expect(s.players[0].holeCards).toEqual([deck[1], deck[3]]);
    s = act(s, "CALL");
    expect(s.phase).toBe("PREFLOP");
    expect(s.actorId).toBe("p1");
    expect(getLegalActions(s, "p1").check).toBe(true);
    s = act(s, "CHECK");
    expect([s.phase, s.actorId]).toEqual(["FLOP", "p1"]);
    expect(s.burns).toEqual([deck[4]]);
    expect(s.board).toEqual(deck.slice(5, 8));
    s = act(act(s, "CHECK"), "CHECK");
    expect([s.phase, s.actorId, s.burns.length]).toEqual(["TURN", "p1", 2]);
    s = act(act(s, "CHECK"), "CHECK");
    expect([s.phase, s.actorId, s.burns.length]).toEqual(["RIVER", "p1", 3]);
    s = act(act(s, "CHECK"), "CHECK");
    expect(s.phase).toBe("FINISHED");
    expectChips(s);
    s = success(startHand(s));
    expect([s.buttonSeat, s.smallBlindSeat, s.bigBlindSeat, s.actorId]).toEqual(
      [1, 1, 0, "p1"],
    );
  });
  it.each([3, 4, 5, 6])("has correct %i-player pre/postflop order", (n) => {
    let s = start(Array(n).fill(1000));
    expect(s.actorId).toBe(n === 3 ? "p0" : "p3");
    s = checkToFlop(s);
    expect(s.actorId).toBe("p1");
    expect(s.deckCursor).toBe(n * 2 + 4);
  });
  it("ends immediately when all but one fold without revealing cards or board", () => {
    let s = start();
    s = act(s, "FOLD");
    s = act(s, "FOLD");
    expect(s.phase).toBe("FINISHED");
    expect(s.board).toEqual([]);
    expect(s.result!.reason).toBe("UNCONTESTED");
    expect(s.result!.pots[0].shares).toEqual([{ playerId: "p2", amount: 10 }]);
    expect(s.players.every((p) => !p.revealed)).toBe(true);
    expectChips(s);
    expect(applyAction(s, { playerId: "p2", type: "ALL_IN" }).ok).toBe(false);
  });
  it("keeps a full preflop bring-in with a short BB and multiple funded opponents", () => {
    let s = start([1000, 1000, 3]);
    expect(s.currentBet).toBe(10);
    expect(getLegalActions(s, "p0").call).toBe(10);
    s = act(act(s, "CALL"), "CALL");
    expect(s.phase).toBe("FLOP");
    expect(s.actorId).toBe("p1");
    expect(s.players.map((p) => p.totalCommitted)).toEqual([10, 10, 3]);
  });
  it.each([
    [1000, 3],
    [2, 1000],
    [2, 3],
  ])("automatically runs out already-covered short blinds %j", (a, b) => {
    const s = start([a, b]);
    expect(s.phase).toBe("FINISHED");
    expect(s.actionHistory).toHaveLength(0);
    expect(s.board).toHaveLength(5);
    expect(s.burns).toHaveLength(3);
    expect(s.players.every((p) => p.revealed)).toBe(true);
    expectChips(s);
  });
  it("a lone funded player must answer an uncovered all-in but cannot raise into a dry side pot", () => {
    let s = start([1000, 8]);
    expect(s.actorId).toBe("p0");
    expect(getLegalActions(s, "p0").call).toBe(3);
    expect(getLegalActions(s, "p0").raiseTo).toBeNull();
    s = act(s, "CALL");
    expect(s.phase).toBe("FINISHED");
    expect(s.result!.pots[0].amount).toBe(16);
    expectChips(s);
  });
  it("rejects invalid decks and hand starts immutably", () => {
    const s = table();
    for (const deck of [
      [],
      createDeck().slice(1),
      [...createDeck().slice(1), createDeck()[1]],
    ]) {
      const result = startHand(s, deck);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(s);
      expect(s.phase).toBe("WAITING");
    }
    expect(startHand(start()).ok).toBe(false);
    expect(startHand(table([100])).ok).toBe(false);
  });
});
describe("between-hand table changes and moving button", () => {
  it("rejects table changes mid-hand and validates seats, stacks and total chip safety", () => {
    const s = start();
    expect(
      updateTable(s, { type: "TOP_UP", playerId: "p0", amount: 10 }).ok,
    ).toBe(false);
    const waiting = table();
    expect(
      updateTable(waiting, { type: "JOIN", player: { id: "p0", seat: 4 } }).ok,
    ).toBe(false);
    expect(
      updateTable(waiting, { type: "JOIN", player: { id: "x", seat: 0 } }).ok,
    ).toBe(false);
    expect(
      updateTable(waiting, {
        type: "TOP_UP",
        playerId: "p0",
        amount: Number.MAX_SAFE_INTEGER,
      }).ok,
    ).toBe(false);
    expect(
      updateTable(waiting, { type: "TOP_UP", playerId: "p0", amount: 1.5 }).ok,
    ).toBe(false);
    expect(() => createTable([{ id: "a", seat: 7 }])).toThrow();
    expect(() =>
      createTable([
        { id: "a", seat: 0, stack: Number.MAX_SAFE_INTEGER },
        { id: "b", seat: 1, stack: 1 },
      ]),
    ).toThrow();
  });
  it("skips sit-outs, removes players, accepts new seats and top-ups between hands", () => {
    let s = act(act(start(), "FOLD"), "FOLD");
    s = success(updateTable(s, { type: "LEAVE", playerId: "p1" }));
    expect(s.players.map((p) => p.id)).toEqual(["p0", "p2"]);
    s = success(
      updateTable(s, {
        type: "JOIN",
        player: { id: "new", seat: 4, stack: 100 },
      }),
    );
    s = success(
      updateTable(s, { type: "SIT_OUT", playerId: "p2", sittingOut: true }),
    );
    s = success(updateTable(s, { type: "TOP_UP", playerId: "p0", amount: 50 }));
    s = success(startHand(s));
    expect([s.buttonSeat, s.smallBlindSeat, s.bigBlindSeat]).toEqual([4, 4, 0]);
    expect(s.players.find((p) => p.id === "p2")!.holeCards).toEqual([]);
    expectChips(s);
  });
});

it("adjusts entry to heads-up so a surviving BB does not post BB twice", () => {
  let s = act(act(start(), "FOLD"), "FOLD");
  expect(s.bigBlindSeat).toBe(2);
  s = success(updateTable(s, { type: "LEAVE", playerId: "p0" }));
  s = success(startHand(s));
  expect([s.buttonSeat, s.smallBlindSeat, s.bigBlindSeat]).toEqual([2, 2, 1]);
});
it("keeps pending actors and blind positions correct with non-contiguous, unordered seats", () => {
  let s = success(
    startHand(
      createTable([
        { id: "c", seat: 5 },
        { id: "a", seat: 1 },
        { id: "b", seat: 3 },
      ]),
    ),
  );
  expect([s.buttonSeat, s.smallBlindSeat, s.bigBlindSeat, s.actorId]).toEqual([
    1,
    3,
    5,
    "a",
  ]);
  s = checkToFlop(s);
  expect(s.actorId).toBe("b");
});

it("uses player identity, not a reused seat, when preventing consecutive heads-up BBs", () => {
  let s = act(act(start(), "FOLD"), "FOLD");
  s = success(updateTable(s, { type: "LEAVE", playerId: "p0" }));
  s = success(updateTable(s, { type: "LEAVE", playerId: "p2" }));
  s = success(updateTable(s, { type: "JOIN", player: { id: "new", seat: 2 } }));
  s = success(startHand(s));
  expect([s.buttonSeat, s.bigBlindSeat, s.bigBlindPlayerId]).toEqual([
    1,
    2,
    "new",
  ]);
});
it("preserves the previous BB identity if that player changes seats between hands", () => {
  let s = act(act(start(), "FOLD"), "FOLD");
  s = success(updateTable(s, { type: "LEAVE", playerId: "p0" }));
  s = success(updateTable(s, { type: "LEAVE", playerId: "p2" }));
  s = success(updateTable(s, { type: "JOIN", player: { id: "p2", seat: 4 } }));
  s = success(startHand(s));
  expect([s.buttonSeat, s.bigBlindSeat, s.bigBlindPlayerId]).toEqual([
    4,
    1,
    "p1",
  ]);
});
