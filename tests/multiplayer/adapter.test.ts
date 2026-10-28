import { describe, expect, it } from "vitest";
import {
  applyAction,
  createDeck,
  createTable,
  getPlayerEvents,
  getPlayerView,
  startHand,
  type GameState,
  type Transition,
} from "@pokerez/poker-engine";
import {
  fromSnapshot,
  handHint,
  seatPositions,
} from "../../src/lib/multiplayer/adapter";
import type { RoomSnapshot } from "@pokerez/multiplayer/protocol";
const state = (r: Transition) => {
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};
function snapshot(s: GameState, id: string): RoomSnapshot {
  return {
    room: {
      code: "ABC123",
      name: "Room",
      capacity: 6,
      smallBlind: 5,
      bigBlind: 10,
    },
    playerId: id,
    view: getPlayerView(s, id),
    events: [],
    version: 1,
    connected: s.players.map((p) => p.id),
    turnDeadline: null,
    resume: false,
  };
}
describe("Engine-to-Motion adapter", () => {
  it.each([2, 3, 4, 5, 6])(
    "projects %i stable seats without manufacturing opponents' private cards",
    (n) => {
      const s = state(
        startHand(
          createTable(
            Array.from({ length: n }, (_, seat) => ({
              id: `stable-${seat}`,
              seat,
            })),
          ),
        ),
      );
      const dto = snapshot(s, "stable-1");
      const p = fromSnapshot(dto);
      expect(p.players).toHaveLength(n);
      expect(p.heroId).toBe("stable-1");
      expect(p.positions!["stable-1"]).toEqual({ left: 50, bottom: 3 });
      for (const player of p.players) {
        expect(player.cards).toHaveLength(2);
        if (player.id !== p.heroId) {
          expect(
            player.cards.every((c) => c.rank === "?" && c.suit === ""),
          ).toBe(true);
          expect(player.revealed).toBe(false);
          expect(player.hand).toBeNull();
        }
      }
      expect(Object.keys(p.positions!)).toHaveLength(n);
      expect(s.players[0].holeCards[0].rank).toBeGreaterThan(1);
    },
  );
  it("highlights only made pair/trips cards and preserves a folded owner's visible hand", () => {
    expect(
      handHint(
        [
          { rank: 12, suit: "h" },
          { rank: 12, suit: "s" },
        ],
        [],
      )!.madeCards,
    ).toEqual(["Q♥", "Q♠"]);
    const h = handHint(
      [
        { rank: 12, suit: "h" },
        { rank: 12, suit: "s" },
      ],
      [
        { rank: 12, suit: "d" },
        { rank: 13, suit: "h" },
        { rank: 7, suit: "c" },
      ],
    )!;
    expect(h.label).toBe("Three of a kind");
    expect(new Set(h.madeCards)).toEqual(new Set(["Q♥", "Q♠", "Q♦"]));
    let s = state(
      startHand(
        createTable([
          { id: "a", seat: 0 },
          { id: "b", seat: 1 },
          { id: "c", seat: 2 },
        ]),
      ),
    );
    s = state(applyAction(s, { type: "FOLD", playerId: "a" }));
    const dto = fromSnapshot(snapshot(s, "a"));
    expect(dto.players[0].folded).toBe(true);
    expect(dto.players[0].revealed).toBe(true);
    expect(dto.players[0].cards.every((c) => c.rank !== "?")).toBe(true);
  });
  it("represents every side pot and sums independent winners' payouts", () => {
    const s = createTable([
      { id: "a", seat: 0 },
      { id: "b", seat: 2 },
      { id: "c", seat: 5 },
    ]);
    const dto = snapshot(s, "a");
    dto.view.result = {
      reason: "SHOWDOWN",
      contributions: [],
      hands: [],
      pots: [
        {
          id: "main",
          cap: 100,
          amount: 300,
          contributors: ["a", "b", "c"],
          eligible: ["a", "b", "c"],
          winners: ["b"],
          shares: [{ playerId: "b", amount: 300 }],
        },
        {
          id: "side",
          cap: 300,
          amount: 400,
          contributors: ["a", "c"],
          eligible: ["a", "c"],
          winners: ["a", "c"],
          shares: [
            { playerId: "a", amount: 200 },
            { playerId: "c", amount: 200 },
          ],
        },
      ],
    };
    dto.view.pots = dto.view.result.pots;
    dto.view.totalPot = 700;
    const p = fromSnapshot(dto);
    expect(p.pots).toHaveLength(2);
    expect(p.winners).toEqual(["b", "a", "c"]);
    expect(p.awards).toEqual({ b: 300, a: 200, c: 200 });
    expect(p.awarded).toBe(200);
  });
  it("uses physical order even when player array order changes", () => {
    const p = seatPositions(
      [
        { id: "third", seat: 5 },
        { id: "hero", seat: 1 },
        { id: "second", seat: 3 },
      ],
      "hero",
    );
    expect(p.hero).toEqual({ left: 50, bottom: 3 });
    expect(p.second.left).toBeLessThan(p.third.left);
  });
});
