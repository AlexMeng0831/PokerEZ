import type { SeatPosition } from "./presentation";

// Physical clockwise order is stable. CSS owns spacing; the adapter assigns named slots only.
export function seatPositions(
  players: { id: string; seat: number }[],
  heroId: string,
): Record<string, SeatPosition> {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const pivot = Math.max(
    0,
    sorted.findIndex((p) => p.id === heroId),
  );
  const ordered = [...sorted.slice(pivot), ...sorted.slice(0, pivot)];
  const ring: Record<number, SeatPosition[]> = {
    1: [],
    2: ["north"],
    3: ["north-west", "north-east"],
    4: ["south-west", "north", "south-east"],
    5: ["south-west", "north-west", "north-east", "south-east"],
    6: ["south-west", "north-west", "north", "north-east", "south-east"],
  };
  return Object.fromEntries(
    ordered.map((p, i) => [
      p.id,
      i === 0 ? "south" : ring[players.length][i - 1],
    ]),
  );
}
