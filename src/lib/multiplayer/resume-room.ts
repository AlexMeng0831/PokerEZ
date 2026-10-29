import type { RoomSnapshot } from "@pokerez/multiplayer/protocol";
/** Only a current authenticated server projection can enable the navigation shortcut. */
export function resumableRoom(state: {
  status: string;
  roomVerified: boolean;
  snapshot: RoomSnapshot | null;
}) {
  const { snapshot } = state;
  return state.status === "connected" &&
    state.roomVerified &&
    snapshot?.view.players.some((p) => p.id === snapshot.playerId)
    ? snapshot.room
    : null;
}
