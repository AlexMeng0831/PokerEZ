import { cardKey, SUITS, validateCards } from "./deck.js";
import type { Card, HandCategory, HandValue } from "./types.js";
const CATEGORIES: HandCategory[] = [
  "HIGH_CARD",
  "ONE_PAIR",
  "TWO_PAIR",
  "THREE_OF_A_KIND",
  "STRAIGHT",
  "FLUSH",
  "FULL_HOUSE",
  "FOUR_OF_A_KIND",
  "STRAIGHT_FLUSH",
  "ROYAL_FLUSH",
];
/** Suit is used only to choose stable display cards in equal-value combinations. */
function canonical(cards: readonly Card[]): Card[] {
  return cards
    .map((c) => ({ ...c }))
    .sort(
      (a, b) =>
        b.rank - a.rank || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit),
    );
}
function five(cards: Card[]): HandValue {
  const sorted = canonical(cards);
  const ranks = sorted.map((c) => c.rank);
  const groups = [...new Set(ranks)]
    .map((rank) => ({ rank, count: ranks.filter((r) => r === rank).length }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const unique = [...new Set(ranks)];
  const straight =
    unique.length === 5 && unique[0] - unique[4] === 4
      ? unique[0]
      : unique.join(",") === "14,5,4,3,2"
        ? 5
        : 0;
  let rank: number, kickers: number[];
  if (flush && straight) {
    rank = straight === 14 ? 9 : 8;
    kickers = [straight];
  } else if (groups[0].count === 4) {
    rank = 7;
    kickers = groups.map((g) => g.rank);
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    rank = 6;
    kickers = groups.map((g) => g.rank);
  } else if (flush) {
    rank = 5;
    kickers = ranks;
  } else if (straight) {
    rank = 4;
    kickers = [straight];
  } else if (groups[0].count === 3) {
    rank = 3;
    kickers = groups.map((g) => g.rank);
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    rank = 2;
    kickers = groups.map((g) => g.rank);
  } else if (groups[0].count === 2) {
    rank = 1;
    kickers = groups.map((g) => g.rank);
  } else {
    rank = 0;
    kickers = ranks;
  }
  return { category: CATEGORIES[rank], rank, kickers, bestFive: sorted };
}
export function compareHands(a: HandValue, b: HandValue): number {
  if (a.rank !== b.rank) return Math.sign(a.rank - b.rank);
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const delta = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (delta) return Math.sign(delta);
  }
  return 0;
}
export function evaluateHand(cards: readonly Card[]): HandValue {
  if (!validateCards(cards, 5, 7))
    throw new RangeError("Evaluate 5–7 distinct standard cards");
  const input = canonical(cards);
  let best: HandValue | null = null;
  for (let a = 0; a < input.length - 4; a++)
    for (let b = a + 1; b < input.length - 3; b++)
      for (let c = b + 1; c < input.length - 2; c++)
        for (let d = c + 1; d < input.length - 1; d++)
          for (let e = d + 1; e < input.length; e++) {
            const hand = five([
              input[a],
              input[b],
              input[c],
              input[d],
              input[e],
            ]);
            if (!best || compareHands(hand, best) > 0) best = hand;
          }
  return best!;
}
export function formatCard(card: Card): string {
  return `${({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[card.rank] ?? card.rank}${card.suit}`;
}
export const handCardKeys = (value: HandValue): string[] =>
  value.bestFive.map(cardKey);
