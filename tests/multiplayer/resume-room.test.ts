import { describe, expect, it } from "vitest";
import { createTable, getPlayerView } from "@pokerez/poker-engine";
import { resumableRoom } from "../../src/lib/multiplayer/resume-room";
import type { RoomSnapshot } from "@pokerez/multiplayer/protocol";
const view = getPlayerView(createTable([{ id: "me", seat: 0 }]), "me");
const snapshot: RoomSnapshot = {
  room: {
    code: "ROOM12",
    name: "Room",
    capacity: 6,
    smallBlind: 1,
    bigBlind: 2,
  },
  view,
  playerId: "me",
  events: [],
  version: 1,
  connected: ["me"],
  turnDeadline: null,
  resume: true,
};
describe("server-confirmed Resume Game", () => {
  it("accepts waiting and active rooms only after a current server projection", () => {
    expect(
      resumableRoom({ status: "connected", roomVerified: true, snapshot }),
    ).toEqual(snapshot.room);
  });
  it.each(["connecting", "reconnecting", "error"])(
    "hides stale snapshots while %s",
    (status) => {
      expect(
        resumableRoom({ status, roomVerified: true, snapshot }),
      ).toBeNull();
    },
  );
  it("hides unverified membership, a released seat, or an empty session", () => {
    expect(
      resumableRoom({ status: "connected", roomVerified: false, snapshot }),
    ).toBeNull();
    expect(
      resumableRoom({
        status: "connected",
        roomVerified: true,
        snapshot: null,
      }),
    ).toBeNull();
    expect(
      resumableRoom({
        status: "connected",
        roomVerified: true,
        snapshot: { ...snapshot, playerId: "someone-else" },
      }),
    ).toBeNull();
  });
});
