import { describe, expect, it } from "vitest";
import { buildPots, settlePots } from "../src/pots.js";
import { createDeck } from "../src/deck.js";
import { createTable, startHand } from "../src/game.js";
import { act, cards, checkToFlop, expectChips, success } from "./helpers.js";
function rigDeck(prefix: string) {
  const first = cards(prefix);
  return [
    ...first,
    ...createDeck().filter(
      (c) => !first.some((p) => p.rank === c.rank && p.suit === c.suit),
    ),
  ];
}
describe("pots and settlement", () => {
  it("returns an uncalled overbet, then awards main and side pots to different winners", () => {
    const initial = createTable([
      { id: "p0", seat: 0, stack: 200 },
      { id: "p1", seat: 1, stack: 50 },
      { id: "p2", seat: 2, stack: 100 },
    ]);
    let s = success(
      startHand(initial, rigDeck("As Ks Qs Ah Kh Qh 4c 2c 3d 7h 5c 8s 6c 9c")),
    );
    s = act(act(act(s, "ALL_IN"), "CALL"), "CALL");
    expect(s.phase).toBe("FINISHED");
    expect(s.result!.contributions.map((p) => p.amount)).toEqual([
      100, 50, 100,
    ]);
    expect(s.result!.pots.map((p) => [p.amount, p.winners])).toEqual([
      [150, ["p1"]],
      [100, ["p2"]],
    ]);
    expect(s.players.map((p) => p.stack)).toEqual([100, 150, 100]);
    expect(s.burns).toHaveLength(3);
    expect(s.board).toHaveLength(5);
    expectChips(s);
    const repeated = settlePots(s);
    expect(repeated.ok).toBe(false);
    expect(repeated.state).toBe(s);
  });
  it("layers several all-ins, with an independent winner in every layer", () => {
    const s = createTable(
      [5, 10, 15, 100].map((stack, seat) => ({ id: `p${seat}`, seat, stack })),
    );
    s.phase = "SHOWDOWN";
    s.buttonSeat = 0;
    s.handId = "fixture:1";
    s.board = cards("2c 3d 7h 8s 9c");
    ["As Ah", "Kd Kh", "Qs Qh", "Js Jh"].forEach((input, i) => {
      s.players[i].holeCards = cards(input);
      s.players[i].totalCommitted = [5, 10, 15, 15][i];
      s.players[i].stack -= s.players[i].totalCommitted;
      s.players[i].status = s.players[i].stack === 0 ? "ALL_IN" : "ACTIVE";
    });
    expect(buildPots(s).map((p) => p.amount)).toEqual([20, 15, 10]);
    const settled = success(settlePots(s));
    expect(settled.result!.pots.map((p) => p.winners)).toEqual([
      ["p0"],
      ["p1"],
      ["p2"],
    ]);
    expect(settled.players.map((p) => p.stack)).toEqual([20, 15, 10, 85]);
    expectChips(settled);
    expect(s.result).toBeNull();
  });
  it("keeps folded dead money, splits a board tie and assigns the odd chip left of the button", () => {
    const initial = createTable(
      [0, 1, 2].map((seat) => ({ id: `p${seat}`, seat, stack: 100 })),
      { smallBlind: 1, bigBlind: 2 },
    );
    let s = checkToFlop(
      success(
        startHand(
          initial,
          rigDeck("4c 6c 2c 5c 7c 3c 8c Ts Js Qs 9c Ks Tc As"),
        ),
      ),
    );
    s = act(s, "BET", 3);
    s = act(act(s, "CALL"), "CALL");
    s = act(act(act(s, "CHECK"), "CHECK"), "FOLD");
    expect(s.phase).toBe("RIVER");
    s = act(act(s, "CHECK"), "CHECK");
    const pot = s.result!.pots[0];
    expect(pot.amount).toBe(15);
    expect(pot.contributors).toEqual(["p0", "p1", "p2"]);
    expect(pot.eligible).toEqual(["p1", "p2"]);
    expect(pot.shares).toEqual([
      { playerId: "p1", amount: 8 },
      { playerId: "p2", amount: 7 },
    ]);
    expect(s.players.map((p) => p.stack)).toEqual([95, 103, 102]);
    expect(s.players[0].revealed).toBe(false);
    expectChips(s);
  });
  it("splits each side pot separately and distributes each remainder in seat order", () => {
    const s = createTable(
      [2, 5, 5, 100].map((stack, seat) => ({ id: `p${seat}`, seat, stack })),
    );
    s.phase = "SHOWDOWN";
    s.buttonSeat = 1;
    s.handId = "odd:1";
    s.board = cards("As Ks Qs Js Ts");
    ["2c 3c", "4c 5c", "6c 7c", "8c 9c"].forEach((input, i) => {
      const p = s.players[i];
      p.holeCards = cards(input);
      p.totalCommitted = [2, 5, 5, 5][i];
      p.stack -= p.totalCommitted;
      p.status = p.stack === 0 ? "ALL_IN" : "ACTIVE";
    });
    s.players[3].status = "FOLDED";
    const result = success(settlePots(s));
    expect(result.result!.pots.map((p) => p.shares)).toEqual([
      [
        { playerId: "p2", amount: 3 },
        { playerId: "p0", amount: 3 },
        { playerId: "p1", amount: 2 },
      ],
      [
        { playerId: "p2", amount: 5 },
        { playerId: "p1", amount: 4 },
      ],
    ]);
    expectChips(result);
  });
  it("does not permit settlement of an open betting round", () => {
    const s = success(
      startHand(
        createTable([
          { id: "a", seat: 0 },
          { id: "b", seat: 1 },
        ]),
      ),
    );
    expect(settlePots(s).ok).toBe(false);
  });
});

it("refunds 200 from a 100/300/500 all-in before building 300 main and 400 side", () => {
  let s = success(
    startHand(
      createTable(
        [500, 100, 300].map((stack, seat) => ({ id: `p${seat}`, seat, stack })),
      ),
    ),
  );
  s = act(act(act(s, "ALL_IN"), "ALL_IN"), "ALL_IN");
  expect(s.result!.contributions.map((p) => p.amount)).toEqual([300, 100, 300]);
  expect(s.result!.pots.map((p) => [p.amount, p.eligible])).toEqual([
    [300, ["p0", "p1", "p2"]],
    [400, ["p0", "p2"]],
  ]);
  expectChips(s);
});
