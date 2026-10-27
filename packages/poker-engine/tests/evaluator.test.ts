import { describe, expect, it } from "vitest";
import {
  createDeck,
  draw,
  seededRandom,
  shuffleDeck,
  validateCards,
} from "../src/deck.js";
import { compareHands, evaluateHand } from "../src/hand-evaluator.js";
import type { Card, Rank, Suit } from "../src/types.js";
export function cards(input: string): Card[] {
  return input.split(" ").map((s) => ({
    rank: ("23456789TJQKA".indexOf(s[0]) + 2) as Rank,
    suit: s[1] as Suit,
  }));
}
describe("deck", () => {
  it("has 52 unique cards, deterministic shuffling and immutable draw", () => {
    const deck = createDeck();
    expect(validateCards(deck)).toBe(true);
    expect(shuffleDeck(deck, seededRandom(3))).toEqual(
      shuffleDeck(deck, seededRandom(3)),
    );
    expect(shuffleDeck(deck, seededRandom(4))).not.toEqual(
      shuffleDeck(deck, seededRandom(3)),
    );
    expect(deck).toEqual(createDeck());
    expect(draw(deck, 4, 3)).toEqual({ cards: deck.slice(4, 7), cursor: 7 });
    expect(() => draw(deck, 51, 2)).toThrow();
    expect(() => shuffleDeck(deck, () => 1)).toThrow();
    expect(validateCards([...deck.slice(1), deck[1]])).toBe(false);
  });
});
describe("best five of five to seven", () => {
  const examples = [
    "As Jd 9c 6h 3s",
    "As Ad 9c 6h 3s",
    "As Ad 9c 9h 3s",
    "As Ad Ac 6h 3s",
    "As 2d 3c 4h 5s",
    "As Js 9s 6s 3s",
    "As Ad Ac 6h 6s",
    "As Ad Ac Ah 3s",
    "9s 8s 7s 6s 5s",
    "As Ks Qs Js Ts",
  ];
  it.each(examples.map((s, rank) => [s, rank] as const))(
    "classifies %s",
    (input, rank) => expect(evaluateHand(cards(input)).rank).toBe(rank),
  );
  it("compares all kickers, two pair, full house and flush lexicographically", () => {
    for (const [a, b] of [
      ["As Ad Kh Qc 9s", "Ah Ac Kc Qd 8s"],
      ["As Ad 2h 2c Ks", "Kh Kd Qc Qd As"],
      ["As Ad Ac 2c 2s", "Kh Kd Kc Ah As"],
      ["As Ad Ac Kh Ks", "Ah Ac Ad Qh Qs"],
      ["As Js 9s 6s 4s", "Ah Jh 9h 6h 3h"],
      ["6s 5h 4d 3c 2s", "As 5h 4d 3c 2s"],
    ])
      expect(compareHands(evaluateHand(cards(a)), evaluateHand(cards(b)))).toBe(
        1,
      );
  });
  it("does not rank suits and selects stable best cards regardless of input order", () => {
    const input = cards("As Ad Kc Qh Js Tc 2d");
    expect(evaluateHand(input)).toEqual(evaluateHand([...input].reverse()));
    expect(
      compareHands(
        evaluateHand(cards("As Js 9s 6s 4s")),
        evaluateHand(cards("Ah Jh 9h 6h 4h")),
      ),
    ).toBe(0);
  });
  it("handles a board tie, quads on board and two trips", () => {
    const board = cards("As Kd Qh Jc Ts");
    expect(
      compareHands(
        evaluateHand([...board, ...cards("2s 3d")]),
        evaluateHand([...board, ...cards("4s 5d")]),
      ),
    ).toBe(0);
    expect(evaluateHand(cards("As Ad Ac Kh Kd Kc 2h")).kickers).toEqual([
      14, 13,
    ]);
    expect(evaluateHand(cards("9s 9d 9h 9c As Kd Qc")).kickers).toEqual([
      9, 14,
    ]);
  });
  it("rejects invalid lengths and duplicate cards", () => {
    expect(() => evaluateHand(cards("As As 2c 3d 4h"))).toThrow();
    expect(() => evaluateHand(cards("As 2c 3d 4h"))).toThrow();
  });
});

it("rejects a sparse deck rather than accepting a missing card", () => {
  const deck = createDeck();
  delete deck[10];
  expect(validateCards(deck)).toBe(false);
});

it("selects the best two of three pairs and the highest five-card flush", () => {
  expect(evaluateHand(cards("As Ad Ks Kd Qs Qd 2c")).kickers).toEqual([
    14, 13, 12,
  ]);
  expect(evaluateHand(cards("Ah Kh Jh 8h 7h 4h 3h")).kickers).toEqual([
    14, 13, 11, 8, 7,
  ]);
  expect(evaluateHand(cards("Ah 2h 3h 4h 5h Ks Qd")).kickers).toEqual([5]);
});
it("ties equal straights built from different private aces", () => {
  const board = cards("Ks Qd Jh Tc 2s");
  expect(
    compareHands(
      evaluateHand([...board, ...cards("Ac 3c")]),
      evaluateHand([...board, ...cards("Ad 4d")]),
    ),
  ).toBe(0);
});
