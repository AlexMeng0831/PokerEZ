import { expect, it } from "vitest";
import { seatPositions } from "../../src/lib/multiplayer/seat-layout";
it.each([2, 3, 4, 5, 6])(
  "reserves distinct perimeter slots at %i seats for every viewer",
  (n) => {
    const players = Array.from({ length: n }, (_, i) => ({
      id: String(i),
      seat: i,
    }));
    for (const player of players) {
      const slots = seatPositions([...players].reverse(), player.id);
      expect(slots[player.id]).toBe("south");
      expect(new Set(Object.values(slots)).size).toBe(n);
      expect(
        Object.values(slots).every((s) =>
          /^(north|south)(-west|-east)?$/.test(s),
        ),
      ).toBe(true);
    }
  },
);
