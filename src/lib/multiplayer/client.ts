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
  error: string;
};
export const useRoomStore = create<State>(() => ({
  status: "connecting",
  snapshot: null,
  session: null,
  pending: false,
  error: "",
}));
let socket: Socket<ServerEvents, ClientEvents> | null = null;
let bootstrap: Promise<void> | null = null;
let sending = false;
async function connectGuest(): Promise<void> {
  if (socket) {
    socket.connect();
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
        useRoomStore.setState({ snapshot: null });
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
        useRoomStore.setState({ status: "connected", error: "" }),
      );
      next.on("disconnect", () =>
        useRoomStore.setState({ status: "reconnecting" }),
      );
      next.on("connect_error", (error) => {
        useRoomStore.setState({
          status: "reconnecting",
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
      next.on("session:ready", (data) =>
        useRoomStore.setState({ session: data }),
      );
      next.on("room:left", () => {
        useRoomStore.setState({ snapshot: null });
        usePokerStore.getState().leave();
      });
      next.on("room:state", (data) => {
        const old = useRoomStore.getState().snapshot;
        if (old?.room.code === data.room.code && old.version > data.version)
          return;
        useRoomStore.setState({ snapshot: data, error: "" });
        usePokerStore
          .getState()
          .setRoom({
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
