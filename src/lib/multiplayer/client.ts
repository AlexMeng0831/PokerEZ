"use client";
import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import type {
  Ack,
  ClientEvents,
  CommandInput,
  RoomSnapshot,
  ServerEvents,
  SessionInfo,
} from "@pokerez/multiplayer/protocol";
import { usePokerStore } from "@/lib/store";
type State = {
  status: "connecting" | "connected" | "reconnecting" | "error";
  snapshot: RoomSnapshot | null;
  session: SessionInfo | null;
  pending: boolean;
  roomVerified: boolean;
  error: string;
};
export const useRoomStore = create<State>(() => ({
  status: "connecting",
  snapshot: null,
  session: null,
  pending: false,
  roomVerified: false,
  error: "",
}));
let socket: Socket<ServerEvents, ClientEvents> | null = null;
let bootstrap: Promise<void> | null = null;
let sending = false;
async function connectGuest(): Promise<void> {
  if (socket) {
    if (socket.connected) socket.emit("room:sync");
    else socket.connect();
    return;
  }
  if (bootstrap) return bootstrap;
  bootstrap = (async () => {
    useRoomStore.setState({ status: "connecting", error: "" });
    try {
      const response = await fetch("/api/game/session", {
        method: "POST",
        credentials: "same-origin",
        signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: usePokerStore.getState().name }),
      });
      if (!response.ok)
        throw new Error(
          "Could not create a guest session. Check that the multiplayer server is running.",
        );
      const session = (await response.json()) as SessionInfo;
      useRoomStore.setState({ session });
      if (!session.roomCode) {
        useRoomStore.setState({ snapshot: null, roomVerified: false });
        usePokerStore.getState().leave();
      }
      const endpoint =
        process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? window.location.origin;
      const next: Socket<ServerEvents, ClientEvents> = io(endpoint, {
        autoConnect: false,
        withCredentials: true,
        retries: 2,
        ackTimeout: 4000,
      });
      socket = next;
      next.on("connect", () =>
        useRoomStore.setState({
          status: "connected",
          error: "",
          roomVerified: false,
        }),
      );
      next.on("disconnect", () =>
        useRoomStore.setState({ status: "reconnecting", roomVerified: false }),
      );
      next.on("connect_error", (error) => {
        useRoomStore.setState({
          status: "reconnecting",
          roomVerified: false,
          error:
            error.message === "AUTH_REQUIRED"
              ? "Your guest session needs to reconnect."
              : "Reconnecting to the table…",
        });
        if (error.message === "AUTH_REQUIRED") {
          next.removeAllListeners();
          next.disconnect();
          socket = null;
          useRoomStore.setState({ snapshot: null });
          void connectGuest();
        }
      });
      next.on("session:ready", (data) => {
        useRoomStore.setState({ session: data });
        if (!data.roomCode) {
          useRoomStore.setState({ snapshot: null });
          usePokerStore.getState().leave();
        }
      });
      next.on("room:left", () => {
        useRoomStore.setState((state) => ({
          snapshot: null,
          roomVerified: false,
          session: state.session ? { ...state.session, roomCode: null } : null,
        }));
        usePokerStore.getState().leave();
      });
      next.on("room:state", (data) => {
        const old = useRoomStore.getState().snapshot;
        if (old?.room.code === data.room.code && old.version > data.version)
          return;
        useRoomStore.setState({
          snapshot: data,
          error: "",
          roomVerified: true,
          session: { playerId: data.playerId, roomCode: data.room.code },
        });
        usePokerStore.getState().setRoom({
          code: data.room.code,
          name: data.room.name,
          seats: data.room.capacity,
          blinds: `${data.room.smallBlind} / ${data.room.bigBlind}`,
        });
      });
      next.connect();
    } catch (error) {
      useRoomStore.setState({
        status: "error",
        error: error instanceof Error ? error.message : "Unable to connect.",
      });
    }
  })();
  try {
    await bootstrap;
  } finally {
    bootstrap = null;
  }
}
export async function sendCommand(input: CommandInput): Promise<Ack> {
  if (!socket?.connected) throw new Error("Wait for the table to reconnect.");
  if (sending) throw new Error("Wait for your previous action.");
  sending = true;
  useRoomStore.setState({ pending: true, error: "" });
  try {
    const reply = await socket.emitWithAck("command", {
      ...input,
      requestId: crypto.randomUUID(),
    });
    if (!reply.ok) {
      if (["STALE_REVISION", "STALE_HAND"].includes(reply.error.code))
        socket.emit("room:sync");
      throw new Error(reply.error.message);
    }
    return reply;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Your request could not be confirmed. Reconnect to sync the table.";
    socket?.emit("room:sync");
    useRoomStore.setState({ error: message });
    throw new Error(message);
  } finally {
    sending = false;
    useRoomStore.setState({ pending: false });
  }
}
export function useMultiplayer() {
  const state = useRoomStore();
  useEffect(() => {
    void connectGuest();
  }, []);
  return { ...state, reconnect: () => void connectGuest() };
}

let membershipCheck: Promise<void> | null = null;
/** Refresh cross-tab membership on navigation/focus without trusting persisted lobby metadata. */
export function refreshRoomMembership(): Promise<void> {
  if (membershipCheck) return membershipCheck;
  const before = useRoomStore.getState().snapshot;
  if (!socket?.connected || !before) return Promise.resolve();
  useRoomStore.setState({ roomVerified: false });
  membershipCheck = (async () => {
    try {
      const response = await fetch("/api/game/session", {
        method: "POST",
        credentials: "same-origin",
        signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) return;
      const session = (await response.json()) as SessionInfo;
      // A newer socket projection already supersedes this HTTP request.
      if (useRoomStore.getState().snapshot !== before) return;
      useRoomStore.setState({ session });
      if (
        session.roomCode !== before.room.code ||
        session.playerId !== before.playerId
      ) {
        useRoomStore.setState({ snapshot: null, roomVerified: false });
        usePokerStore.getState().leave();
      }
      if (session.playerId !== before.playerId) {
        socket?.disconnect();
        socket?.connect();
      } else if (session.roomCode) socket?.emit("room:sync");
    } catch {
      /* Leave the shortcut unverified until a fresh socket projection arrives. */
    } finally {
      membershipCheck = null;
    }
  })();
  return membershipCheck;
}
