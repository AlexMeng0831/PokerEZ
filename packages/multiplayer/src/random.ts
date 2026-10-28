import { randomInt } from "node:crypto";
import { createDeck, type Card } from "@pokerez/poker-engine";
/** Fisher–Yates with unbiased cryptographic integer samples; never use engine fixture seeds here. */
export function secureDeck(): Card[] {
  const deck = createDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => alphabet[randomInt(alphabet.length)],
  ).join("");
}
