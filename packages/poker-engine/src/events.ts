import type { GameEvent, GameState, PublicData } from "./types.js";
export function emitPublic(
  state: GameState,
  events: GameEvent[],
  data: PublicData,
): void {
  events.push({
    handId: state.handId,
    seq: ++state.sequence,
    revision: state.revision,
    visibility: "PUBLIC",
    data: structuredClone(data),
  });
}
