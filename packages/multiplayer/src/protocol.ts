import type {
  Action,
  PlayerView,
  PrivateEvent,
  PublicEvent,
} from "@pokerez/poker-engine";
export type GuestAction = Action extends infer A
  ? A extends Action
    ? Omit<A, "playerId">
    : never
  : never;
export type ClientCommand = { requestId: string } & (
  | {
      type: "create";
      name: string;
      capacity: number;
      smallBlind: number;
      bigBlind: number;
    }
  | { type: "join"; code: string }
  | { type: "start" }
  | { type: "leave" }
  | { type: "topup" }
  | { type: "action"; revision: number; handId: string; action: GuestAction }
);
export type CommandInput = ClientCommand extends infer C
  ? C extends ClientCommand
    ? Omit<C, "requestId">
    : never
  : never;
export type Ack =
  | { ok: true; requestId: string; code: string | null; revision: number }
  | { ok: false; requestId: string; error: { code: string; message: string } };
export type RoomInfo = {
  code: string;
  name: string;
  capacity: number;
  smallBlind: number;
  bigBlind: number;
};
export type RoomSnapshot = {
  room: RoomInfo;
  playerId: string;
  view: PlayerView;
  events: (PublicEvent | PrivateEvent)[];
  version: number;
  connected: string[];
  turnDeadline: number | null;
  resume: boolean;
};
export type SessionInfo = { playerId: string; roomCode: string | null };
export interface ServerEvents {
  "room:state": (snapshot: RoomSnapshot) => void;
  "room:left": () => void;
  "session:ready": (session: SessionInfo) => void;
}
export interface ClientEvents {
  command: (command: ClientCommand, ack: (reply: Ack) => void) => void;
  "room:sync": () => void;
}
