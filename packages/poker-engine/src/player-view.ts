import type {
  GameEvent,
  GameState,
  PrivateEvent,
  PublicEvent,
} from "./types.js";
import { getLegalActions } from "./betting.js";
/** Construct a detached allow-listed projection; never spread internal state here. */
export function getPlayerView(
  state: GameState,
  viewerId: string | null = null,
) {
  return structuredClone({
    tableId: state.tableId,
    handId: state.handId,
    handNo: state.handNo,
    revision: state.revision,
    phase: state.phase,
    buttonSeat: state.buttonSeat,
    smallBlindSeat: state.smallBlindSeat,
    bigBlindSeat: state.bigBlindSeat,
    actorId: state.actorId,
    board: state.board,
    currentBet: state.currentBet,
    lastFullRaise: state.lastFullRaise,
    config: {
      smallBlind: state.config.smallBlind,
      bigBlind: state.config.bigBlind,
    },
    totalPot: state.players.reduce((n, p) => n + p.totalCommitted, 0),
    pots: state.pots,
    result: state.result,
    players: state.players.map((p) => ({
      id: p.id,
      seat: p.seat,
      name: p.name,
      stack: p.stack,
      sittingOut: p.sittingOut,
      status: p.status,
      streetCommitted: p.streetCommitted,
      totalCommitted: p.totalCommitted,
      cardCount: p.holeCards.length,
      revealed: p.revealed,
      holeCards: p.id === viewerId || p.revealed ? p.holeCards : null,
    })),
    legalActions: viewerId === null ? null : getLegalActions(state, viewerId),
  });
}
export type PlayerView = ReturnType<typeof getPlayerView>;
export function getPublicEvents(events: readonly GameEvent[]): PublicEvent[] {
  return structuredClone(
    events.filter((e): e is PublicEvent => e.visibility === "PUBLIC"),
  );
}
export function getPlayerEvents(
  events: readonly GameEvent[],
  viewerId: string,
): (PublicEvent | PrivateEvent)[] {
  return structuredClone(
    events.filter(
      (e): e is PublicEvent | PrivateEvent =>
        e.visibility === "PUBLIC" ||
        (e.visibility === "PRIVATE" && e.recipientId === viewerId),
    ),
  );
}
