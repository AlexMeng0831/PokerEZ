import { describe, expect, it } from "vitest";
import { getLegalActions } from "../src/betting.js";
import { applyAction } from "../src/game.js";
import { act, checkToFlop, expectChips, start } from "./helpers.js";
describe("betting", () => {
  it("uses raise-to totals and the last full increment for consecutive raises", () => {
    let s = start();
    expect(getLegalActions(s, "p0").raiseTo).toEqual({
      minTo: 20,
      fullMinTo: 20,
      maxTo: 1000,
    });
    s = act(s, "RAISE_TO", 30);
    expect(s.players[0].stack).toBe(970);
    expect(s.lastFullRaise).toBe(20);
    expect(getLegalActions(s, "p1").raiseTo!.minTo).toBe(50);
    s = act(s, "RAISE_TO", 70);
    expect(s.lastFullRaise).toBe(40);
    expect(getLegalActions(s, "p2").raiseTo!.minTo).toBe(110);
    expectChips(s);
  });
  it("does not reopen a prior raiser after a single short all-in", () => {
    let s = start([1000, 150, 1000]);
    s = act(s, "RAISE_TO", 100);
    s = act(s, "ALL_IN");
    expect(s.currentBet).toBe(150);
    expect(s.lastFullRaise).toBe(90);
    s = act(s, "CALL");
    expect(s.actorId).toBe("p0");
    expect(getLegalActions(s, "p0").canRaise).toBe(false);
    expect(getLegalActions(s, "p0").allIn).toBeNull();
    expect(
      applyAction(s, { type: "RAISE_TO", to: 240, playerId: "p0" }).ok,
    ).toBe(false);
    s = act(s, "CALL");
    expect(s.phase).toBe("FLOP");
    expectChips(s);
  });
  it("cumulative short all-ins reopen different players at different thresholds", () => {
    let s = start([190, 1000, 1000, 1000, 150, 1000]);
    expect(s.actorId).toBe("p3");
    s = act(s, "RAISE_TO", 100);
    s = act(s, "ALL_IN"); // p4 to 150; +50 short
    s = act(s, "CALL"); // p5 calls 150, threshold 240
    s = act(s, "ALL_IN"); // p0 to 190; +40 short
    s = act(s, "CALL"); // p1
    s = act(s, "CALL"); // p2
    expect(s.actorId).toBe("p3");
    expect(s.lastFullRaise).toBe(90);
    expect(getLegalActions(s, "p3").raiseTo!.minTo).toBe(280);
    s = act(s, "CALL");
    expect(s.actorId).toBe("p5");
    expect(getLegalActions(s, "p5").canRaise).toBe(false);
    expect(getLegalActions(s, "p5").call).toBe(40);
  });
  it("a full raise reopens rights and resets the next minimum increment", () => {
    let s = start([1000, 150, 1000]);
    s = act(s, "RAISE_TO", 100);
    s = act(s, "ALL_IN");
    s = act(s, "RAISE_TO", 300);
    expect(getLegalActions(s, "p0").raiseTo!.minTo).toBe(450);
  });
  it("checked players cannot raise a sub-minimum opener until facing a full bet", () => {
    let s = checkToFlop(start([1000, 1000, 14, 1000]));
    expect(s.actorId).toBe("p1");
    s = act(s, "CHECK");
    s = act(s, "ALL_IN"); // p2 short opening bet 4
    expect(getLegalActions(s, "p3").raiseTo!.minTo).toBe(14);
    s = act(s, "CALL");
    s = act(s, "CALL");
    expect(s.actorId).toBe("p1");
    expect(getLegalActions(s, "p1").canRaise).toBe(false);
  });
  it("cumulative short opening bets reopen a prior check but not a later caller", () => {
    let s = checkToFlop(start([20, 1000, 14, 1000]));
    s = act(s, "CHECK"); // p1 checked at 0
    s = act(s, "ALL_IN"); // p2 to 4
    s = act(s, "CALL"); // p3 called 4
    s = act(s, "ALL_IN"); // p0 to 10
    expect(s.actorId).toBe("p1");
    expect(getLegalActions(s, "p1").raiseTo!.minTo).toBe(20);
    s = act(s, "CALL");
    expect(s.actorId).toBe("p3");
    expect(getLegalActions(s, "p3").canRaise).toBe(false);
  });
  it("supports partial calls and an all-in too small for the full minimum raise", () => {
    let s = start([1000, 17, 1000]);
    s = act(s, "RAISE_TO", 30);
    expect(getLegalActions(s, "p1").call).toBe(12);
    s = act(s, "CALL");
    expect(s.players[1].totalCommitted).toBe(17);
    expect(s.players[1].status).toBe("ALL_IN");
    s = act(s, "CALL");
    expectChips(s);
    let t = start([1000, 15, 1000]);
    t = act(t, "CALL");
    expect(getLegalActions(t, "p1").raiseTo).toEqual({
      minTo: 15,
      maxTo: 15,
      fullMinTo: 20,
    });
    t = act(t, "RAISE_TO", 15);
    expect(t.lastFullRaise).toBe(10);
  });
  it("rejects illegal actions without changing or cloning the input state", () => {
    const s = start();
    const original = structuredClone(s);
    for (const action of [
      { type: "CHECK", playerId: "p0" },
      { type: "CALL", playerId: "p1" },
      ...[
        0,
        -1,
        10,
        19,
        1001,
        NaN,
        Infinity,
        20.5,
        Number.MAX_SAFE_INTEGER + 1,
      ].map((to) => ({ type: "RAISE_TO", to, playerId: "p0" })),
      { type: "BET", to: 20, playerId: "p0" },
      { type: "NOPE", playerId: "p0" },
    ]) {
      const result = applyAction(s, action as never);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(s);
      expect(result.events).toEqual([]);
      expect(s).toEqual(original);
    }
    expect(
      applyAction(s, { type: "CALL", playerId: "p0" }, s.revision - 1).ok,
    ).toBe(false);
  });
});

it("retains safe-integer metadata even at the maximum supported chip total", () => {
  let s = start([6000000000000000, 3000000000000000, 100]);
  s = act(s, "ALL_IN");
  expect(
    s.players.every(
      (p) => p.reopenAt === null || Number.isSafeInteger(p.reopenAt),
    ),
  ).toBe(true);
  expectChips(s);
  s = act(act(s, "CALL"), "CALL");
  expect(s.phase).toBe("FINISHED");
  expectChips(s);
});

it("the unraised heads-up BB may raise and reopen the button's action", () => {
  let s = start([1000, 1000]);
  s = act(s, "CALL");
  expect(getLegalActions(s, "p1").raiseTo!.minTo).toBe(20);
  s = act(s, "RAISE_TO", 40);
  expect(s.phase).toBe("PREFLOP");
  expect(s.actorId).toBe("p0");
  expect(getLegalActions(s, "p0").raiseTo!.minTo).toBe(70);
});
it("rejects a non-all-in underbet while accepting an exact short-stack bet", () => {
  let s = checkToFlop(start([1000, 14, 1000]));
  expect(getLegalActions(s, "p1").bet).toEqual({
    minTo: 4,
    maxTo: 4,
    fullMinTo: 10,
  });
  s = act(s, "BET", 4);
  expect(s.players[1].status).toBe("ALL_IN");
  const funded = checkToFlop(start());
  expect(
    applyAction(funded, { type: "BET", to: 4, playerId: funded.actorId! }).ok,
  ).toBe(false);
});
