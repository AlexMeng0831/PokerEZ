import { evaluateHand, type Card, type HandValue } from "@pokerez/poker-engine";
import type { RoomSnapshot } from "@pokerez/multiplayer/protocol";
import type {
  SeatPosition,
  TablePresentation,
  VisualCard,
  VisualHand,
  VisualPlayer,
} from "./presentation";
export const visualCard = (c: Card): VisualCard => ({
  rank:
    ({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[
      c.rank
    ] ?? String(c.rank),
  suit: { c: "♣", d: "♦", h: "♥", s: "♠" }[c.suit],
});
export const unknownCard = (): VisualCard => ({ rank: "?", suit: "" });
export function handHint(cards: Card[], board: Card[]): VisualHand | null {
  if (cards.length !== 2) return null;
  const all = [...cards, ...board];
  if (all.length < 5) {
    const pair = cards[0].rank === cards[1].rank;
    return pair
      ? {
          label: "Pair",
          detail: rankName(cards[0].rank, true),
          madeCards: cards.map((c) => {
            const v = visualCard(c);
            return v.rank + v.suit;
          }),
        }
      : null;
  }
  return valueHint(evaluateHand(all));
}
function rankName(rank: number, plural = false) {
  const name = (
    {
      14: "Ace",
      13: "King",
      12: "Queen",
      11: "Jack",
      10: "Ten",
      9: "Nine",
      8: "Eight",
      7: "Seven",
      6: "Six",
      5: "Five",
      4: "Four",
      3: "Three",
      2: "Two",
    } as Record<number, string>
  )[rank];
  return plural && rank === 6 ? "Sixes" : name + (plural ? "s" : "");
}
export function valueHint(value: HandValue): VisualHand {
  const labels = {
    HIGH_CARD: "High card",
    ONE_PAIR: "Pair",
    TWO_PAIR: "Two pair",
    THREE_OF_A_KIND: "Three of a kind",
    STRAIGHT: "Straight",
    FLUSH: "Flush",
    FULL_HOUSE: "Full house",
    FOUR_OF_A_KIND: "Four of a kind",
    STRAIGHT_FLUSH: "Straight flush",
    ROYAL_FLUSH: "Royal flush",
  };
  const groups =
    value.category === "ONE_PAIR" ||
    value.category === "THREE_OF_A_KIND" ||
    value.category === "FOUR_OF_A_KIND"
      ? [value.kickers[0]]
      : value.category === "TWO_PAIR"
        ? value.kickers.slice(0, 2)
        : null;
  const chosen = groups
    ? value.bestFive.filter((c) => groups.includes(c.rank))
    : value.category === "HIGH_CARD"
      ? value.bestFive.filter((c) => c.rank === value.kickers[0])
      : value.bestFive;
  return {
    label: labels[value.category],
    detail: rankName(value.kickers[0], !!groups),
    madeCards: chosen.map((c) => {
      const v = visualCard(c);
      return v.rank + v.suit;
    }),
  };
}
/** Positions are relative to the viewer; identity and physical seat order stay stable. */
export function seatPositions(
  players: { id: string; seat: number }[],
  heroId: string,
): Record<string, SeatPosition> {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const hero = sorted.findIndex((p) => p.id === heroId);
  const ordered = [...sorted.slice(hero), ...sorted.slice(0, hero)];
  const patterns: Record<number, SeatPosition[]> = {
    1: [],
    2: [{ left: 50, top: 3 }],
    3: [
      { left: 27, top: 9 },
      { left: 73, top: 9 },
    ],
    4: [
      { left: 15, top: 65 },
      { left: 50, top: 8 },
      { left: 85, top: 65 },
    ],
    5: [
      { left: 15, top: 65 },
      { left: 24, top: 12 },
      { left: 76, top: 12 },
      { left: 85, top: 65 },
    ],
    6: [
      { left: 15, top: 65 },
      { left: 16, top: 22 },
      { left: 50, top: 6 },
      { left: 84, top: 22 },
      { left: 85, top: 65 },
    ],
  };
  return Object.fromEntries(
    ordered.map((p, i) => [
      p.id,
      i === 0
        ? { left: 50, bottom: 3 }
        : (patterns[players.length] ?? patterns[6])[i - 1],
    ]),
  );
}
export function fromSnapshot(
  snapshot: RoomSnapshot,
  prior?: TablePresentation,
): TablePresentation {
  const { view, playerId } = snapshot;
  const same = prior?.handId === view.handId;
  const awards: Record<string, number> = {};
  for (const pot of view.result?.pots ?? [])
    for (const share of pot.shares)
      awards[share.playerId] = (awards[share.playerId] ?? 0) + share.amount;
  const players: VisualPlayer[] = view.players.map((p) => ({
    id: p.id,
    name: p.id === playerId ? "You" : p.name,
    stack: p.stack,
    bet: p.streetCommitted,
    cards: p.holeCards
      ? p.holeCards.map(visualCard)
      : Array.from({ length: p.cardCount }, unknownCard),
    folded: p.status === "FOLDED",
    revealed: p.holeCards !== null,
    hand: p.holeCards ? handHint(p.holeCards, view.board) : null,
    action:
      p.status === "FOLDED"
        ? "Folded"
        : p.status === "ALL_IN"
          ? "All in"
          : same
            ? (prior?.players.find((q) => q.id === p.id)?.action ?? "Seated")
            : "Seated",
    role:
      p.seat === view.buttonSeat
        ? "D"
        : p.seat === view.smallBlindSeat
          ? "SB"
          : p.seat === view.bigBlindSeat
            ? "BB"
            : undefined,
    connected: snapshot.connected.includes(p.id),
  }));
  return {
    players,
    board: view.board.map((c) => ({ card: visualCard(c), revealed: true })),
    pot:
      view.totalPot - view.players.reduce((n, p) => n + p.streetCommitted, 0),
    pots:
      view.pots.length > 1
        ? view.pots.map((p, i) => ({
            id: p.id,
            label: i === 0 ? "Main pot" : `Side pot ${i}`,
            amount: p.amount,
            eligible: p.eligible,
          }))
        : [],
    winner: Object.keys(awards)[0] ?? null,
    awarded: awards[playerId] ?? 0,
    winners: Object.keys(awards),
    awards,
    heroId: playerId,
    dealerId: view.players.find((p) => p.seat === view.buttonSeat)?.id,
    positions: seatPositions(view.players, playerId),
    handId: view.handId,
    handLabel: view.handNo
      ? `HAND #${String(view.handNo).padStart(3, "0")}`
      : "WAITING FOR PLAYERS",
  };
}
