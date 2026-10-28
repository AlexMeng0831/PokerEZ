import {
  applyAction,
  createTable,
  startHand,
  updateTable,
  type Card,
  type GameEvent,
  type GameState,
  type Transition,
} from "@pokerez/poker-engine";
import { roomCode, secureDeck } from "./random.js";
import type { ClientCommand, RoomInfo } from "./protocol.js";
import type { Session } from "./sessions.js";
export type Room = {
  info: RoomInfo;
  state: GameState;
  version: number;
  lastActive: number;
  turnDeadline: number | null;
};
type Result =
  | { ok: true; room: Room | null; events: GameEvent[]; left?: Room }
  | { ok: false; error: { code: string; message: string } };
const deny = (code: string, message: string): Result => ({
  ok: false,
  error: { code, message },
});
export function createRooms(
  sessions: Map<string, Session>,
  deal: () => Card[] = secureDeck,
) {
  const rooms = new Map<string, Room>();
  function transition(room: Room, result: Transition): Result {
    if (!result.ok) return { ok: false, error: result.error };
    room.state = result.state;
    room.lastActive = Date.now();
    return { ok: true, room, events: result.events };
  }
  function execute(session: Session, command: ClientCommand): Result {
    if (command.type === "create") {
      if (session.roomCode)
        return deny("ALREADY_SEATED", "Leave your current room first.");
      if (rooms.size >= 256) return deny("CAPACITY", "Room capacity reached.");
      let code = roomCode();
      while (rooms.has(code)) code = roomCode();
      const info: RoomInfo = {
        code,
        name: command.name,
        capacity: command.capacity,
        smallBlind: command.smallBlind,
        bigBlind: command.bigBlind,
      };
      const state = createTable(
        [
          {
            id: session.id,
            seat: 0,
            name: session.name === "Player" ? "Player 1" : session.name,
          },
        ],
        { smallBlind: info.smallBlind, bigBlind: info.bigBlind },
        code,
      );
      const room: Room = {
        info,
        state,
        version: 0,
        lastActive: Date.now(),
        turnDeadline: null,
      };
      rooms.set(code, room);
      session.roomCode = code;
      return { ok: true, room, events: [] };
    }
    if (command.type === "join") {
      const room = rooms.get(command.code);
      if (!room)
        return deny(
          "ROOM_NOT_FOUND",
          "That room does not exist or has expired.",
        );
      if (session.roomCode === command.code)
        return { ok: true, room, events: [] };
      if (session.roomCode)
        return deny("ALREADY_SEATED", "Leave your current room first.");
      if (room.state.players.length >= room.info.capacity)
        return deny("ROOM_FULL", "This table is full.");
      const seat = Array.from({ length: 6 }, (_, i) => i).find(
        (i) => !room.state.players.some((p) => p.seat === i),
      )!;
      const result = transition(
        room,
        updateTable(room.state, {
          type: "JOIN",
          player: {
            id: session.id,
            seat,
            name:
              session.name === "Player" ? `Player ${seat + 1}` : session.name,
          },
        }),
      );
      if (result.ok) session.roomCode = room.info.code;
      return result;
    }
    const room = session.roomCode ? rooms.get(session.roomCode) : undefined;
    if (!room || !room.state.players.some((p) => p.id === session.id))
      return deny("NOT_SEATED", "Join a room first.");
    if (command.type === "leave") {
      const result = transition(
        room,
        updateTable(room.state, { type: "LEAVE", playerId: session.id }),
      );
      if (!result.ok) return result;
      session.roomCode = null;
      if (room.state.players.length === 0) rooms.delete(room.info.code);
      return { ok: true, room: null, left: room, events: result.events };
    }
    if (command.type === "topup") {
      if (room.state.players.find((p) => p.id === session.id)!.stack !== 0)
        return deny("ALREADY_FUNDED", "Your seat already has chips.");
      return transition(
        room,
        updateTable(room.state, {
          type: "TOP_UP",
          playerId: session.id,
          amount: 1000,
        }),
      );
    }
    if (command.type === "start") {
      if (!["WAITING", "FINISHED"].includes(room.state.phase))
        return deny("HAND_IN_PROGRESS", "The current hand is still running.");
      let state = room.state;
      const events: GameEvent[] = [];
      for (const p of state.players) {
        const sittingOut = !sessions.get(p.id)?.sockets.size;
        if (p.sittingOut !== sittingOut) {
          const r = updateTable(state, {
            type: "SIT_OUT",
            playerId: p.id,
            sittingOut,
          });
          if (r.ok) {
            state = r.state;
            events.push(...r.events);
          }
        }
      }
      const next = startHand(state, deal());
      if (!next.ok) return { ok: false, error: next.error };
      const result = transition(room, next);
      if (result.ok) result.events = [...events, ...result.events];
      return result;
    }
    if (command.handId !== room.state.handId)
      return deny("STALE_HAND", "This action belongs to an earlier hand.");
    return transition(
      room,
      applyAction(
        room.state,
        { ...command.action, playerId: session.id },
        command.revision,
      ),
    );
  }
  return { rooms, execute };
}
