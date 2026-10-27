import type { Card, Rank, Suit } from "./types.js";
export const SUITS: Suit[] = ["c", "d", "h", "s"];
export const cardKey = (card: Card): string => `${card.rank}${card.suit}`;
export function isCard(card: unknown): card is Card {
  if (!card || typeof card !== "object") return false;
  const c = card as Card;
  return (
    Number.isInteger(c.rank) &&
    c.rank >= 2 &&
    c.rank <= 14 &&
    SUITS.includes(c.suit)
  );
}
export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({ rank: (i + 2) as Rank, suit })),
  );
}
export function validateCards(
  cards: readonly Card[],
  min = 52,
  max = 52,
): boolean {
  return (
    Array.isArray(cards) &&
    cards.length >= min &&
    cards.length <= max &&
    Array.from(cards).every(isCard) &&
    new Set(cards.map(cardKey)).size === cards.length
  );
}
/** Small deterministic PRNG for fixtures/self-play, not a secure multiplayer dealer. */
export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffleDeck(
  cards: readonly Card[],
  random: () => number,
): Card[] {
  if (!validateCards(cards))
    throw new RangeError("A complete unique 52-card deck is required");
  const result = cards.map((c) => ({ ...c }));
  for (let i = result.length - 1; i > 0; i--) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new RangeError("Random source must return [0, 1)");
    const j = Math.floor(value * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function draw(
  deck: readonly Card[],
  cursor: number,
  count = 1,
): { cards: Card[]; cursor: number } {
  if (
    !Number.isInteger(cursor) ||
    !Number.isInteger(count) ||
    cursor < 0 ||
    count < 0 ||
    cursor + count > deck.length
  )
    throw new RangeError("Deck exhausted or invalid draw");
  return {
    cards: deck.slice(cursor, cursor + count).map((c) => ({ ...c })),
    cursor: cursor + count,
  };
}
