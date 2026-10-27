import { expect, it } from "vitest";
import fc from "fast-check";
import { getLegalActions } from "../src/betting.js";
import { createDeck } from "../src/deck.js";
import { compareHands, evaluateHand } from "../src/hand-evaluator.js";
import { applyAction, createTable, startHand } from "../src/game.js";
import { createHistory, replayHistory } from "../src/history.js";
import { getPlayerView } from "../src/player-view.js";
import { expectChips, success } from "./helpers.js";
import type { Action, GameState } from "../src/types.js";
function freeze(value: unknown): void {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
}
function invariant(s: GameState): void {
  expectChips(s);
  const drawn = [
    ...s.players.flatMap((p) => p.holeCards),
    ...s.burns,
    ...s.board,
  ];
  const keys = drawn.map((c) => `${c.rank}${c.suit}`);
  expect(new Set(keys).size).toBe(keys.length);
  expect([...keys].sort()).toEqual(
    s.deck
      .slice(0, s.deckCursor)
      .map((c) => `${c.rank}${c.suit}`)
      .sort(),
  );
  expect(
    s.players.every(
      (p) => p.reopenAt === null || Number.isSafeInteger(p.reopenAt),
    ),
  ).toBe(true);
  const view = getPlayerView(s);
  expect(view.players.every((p) => p.revealed || p.holeCards === null)).toBe(
    true,
  );
  if (s.phase !== "FINISHED") {
    expect(s.actorId).not.toBeNull();
    expect(s.pending).toContain(s.actorId);
    expect(s.players.find((p) => p.id === s.actorId)!.status).toBe("ACTIVE");
  } else {
    expect(s.actorId).toBeNull();
    expect(s.pending).toEqual([]);
    expect(s.players.every((p) => p.totalCommitted === 0)).toBe(true);
    for (const pot of s.result!.pots) {
      expect(pot.shares.reduce((n, p) => n + p.amount, 0)).toBe(pot.amount);
      expect(
        pot.winners.every(
          (id) => s.players.find((p) => p.id === id)!.status !== "FOLDED",
        ),
      ).toBe(true);
    }
  }
}
function choose(s: GameState, decision: number, passive: boolean): Action {
  const playerId = s.actorId!;
  const legal = getLegalActions(s, playerId);
  const choices: Action[] = [];
  if (legal.check) choices.push({ playerId, type: "CHECK" });
  if (legal.call !== null) choices.push({ playerId, type: "CALL" });
  if (passive) return choices[0];
  choices.push({ playerId, type: "FOLD" });
  if (legal.allIn) choices.push({ playerId, type: "ALL_IN" });
  for (const [type, range] of [
    ["BET", legal.bet],
    ["RAISE_TO", legal.raiseTo],
  ] as const) {
    if (range) {
      choices.push({ playerId, type, to: range.minTo });
      choices.push({
        playerId,
        type,
        to: range.minTo + (decision % (range.maxTo - range.minTo + 1)),
      });
    }
  }
  return choices[decision % choices.length];
}
it("random legal 2–6 player hands conserve chips, cards, rights and deterministic history", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 1, max: 500 }), {
        minLength: 2,
        maxLength: 6,
      }),
      fc.integer({ min: 1, max: 10 }),
      fc.integer(),
      fc.array(fc.nat(), { minLength: 20, maxLength: 180 }),
      (stacks, sb, seed, decisions) => {
        let initial = createTable(
          stacks.map((stack, seat) => ({ id: `id:${seat}`, seat, stack })),
          { smallBlind: sb, bigBlind: sb * 2, shuffleSeed: seed },
        );
        for (let hand = 0; hand < 3; hand++) {
          if (initial.players.filter((p) => p.stack > 0).length < 2) break;
          freeze(initial);
          let s = success(startHand(initial));
          invariant(s);
          let steps = 0;
          while (s.phase !== "FINISHED") {
            if (steps > 300) throw new Error("Hand did not terminate");
            freeze(s);
            const rejected = applyAction(s, {
              type: "CALL",
              playerId: "spectator",
            });
            expect(rejected.state).toBe(s);
            expect(rejected.ok).toBe(false);
            s = success(
              applyAction(
                s,
                choose(s, decisions[steps % decisions.length], steps > 150),
              ),
            );
            invariant(s);
            steps++;
          }
          const history = createHistory(initial, s);
          expect(
            replayHistory(JSON.parse(JSON.stringify(history))).state,
          ).toEqual(s);
          initial = s;
        }
      },
    ),
    { numRuns: 250, seed: 20261027 },
  );
}, 30000);
it("random evaluator results are stable under order and suit relabeling", () => {
  const deck = createDeck();
  fc.assert(
    fc.property(
      fc.uniqueArray(fc.integer({ min: 0, max: 51 }), {
        minLength: 5,
        maxLength: 7,
      }),
      (indices) => {
        const cards = indices.map((i) => deck[i]);
        const value = evaluateHand(cards);
        expect(value).toEqual(evaluateHand([...cards].reverse()));
        const suits = ["c", "d", "h", "s"] as const;
        const relabeled = cards.map((c) => ({
          rank: c.rank,
          suit: suits[(suits.indexOf(c.suit) + 1) % 4],
        }));
        expect(compareHands(value, evaluateHand(relabeled))).toBe(0);
        expect(compareHands(value, evaluateHand(value.bestFive))).toBe(0);
        expect(value.bestFive).toHaveLength(5);
      },
    ),
    { numRuns: 150, seed: 14051 },
  );
});
