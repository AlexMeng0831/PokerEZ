"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
type Room = { code: string; name: string; blinds: string; seats: number };
type State = {
  name: string;
  room: Room | null;
  setName: (name: string) => void;
  setRoom: (room: Room) => void;
  leave: () => void;
};
export const usePokerStore = create<State>()(
  persist(
    (set) => ({
      name: "Player",
      room: null,
      setName: (name) => set({ name }),
      setRoom: (room) => set({ room }),
      leave: () => set({ room: null }),
    }),
    { name: "pokerez-local" },
  ),
);
