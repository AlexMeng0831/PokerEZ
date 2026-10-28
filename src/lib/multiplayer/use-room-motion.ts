"use client";
import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "@pokerez/multiplayer/protocol";
import type { Flight } from "@/components/poker/animation/primitives";
import {
  fromSnapshot,
  handHint,
  unknownCard,
  valueHint,
  visualCard,
} from "./adapter";
import type { TablePresentation } from "./presentation";
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
export function useRoomMotion(snapshot: RoomSnapshot | null, reduced: boolean) {
  const [presentation, setPresentation] = useState<TablePresentation | null>(
    null,
  );
  const current = useRef<TablePresentation | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [busy, setBusy] = useState(false);
  const queue = useRef<RoomSnapshot[]>([]);
  const controller = useRef<AbortController | null>(null);
  const seen = useRef<{ code: string; version: number } | null>(null);
  const serial = useRef(0);
  const pref = useRef(reduced);
  pref.current = reduced;
  const set = (value: TablePresentation) => {
    current.current = value;
    setPresentation(value);
  };
  useEffect(
    () => () => {
      controller.current?.abort();
      queue.current = [];
    },
    [],
  );
  useEffect(() => {
    if (!snapshot) {
      controller.current?.abort();
      controller.current = null;
      queue.current = [];
      seen.current = null;
      current.current = null;
      setPresentation(null);
      setFlights([]);
      setBusy(false);
      return;
    }
    if (
      seen.current?.code === snapshot.room.code &&
      seen.current.version >= snapshot.version &&
      !snapshot.resume
    )
      return;
    seen.current = { code: snapshot.room.code, version: snapshot.version };
    if (snapshot.resume || !current.current || queue.current.length > 12) {
      controller.current?.abort();
      controller.current = null;
      queue.current = [];
      set(fromSnapshot(snapshot));
      setFlights([]);
      setBusy(false);
      return;
    }
    queue.current.push(snapshot);
    if (controller.current) return;
    const own = new AbortController();
    controller.current = own;
    setBusy(true);
    async function run() {
      try {
        while (queue.current.length) {
          const packet = queue.current.shift()!;
          let state = current.current!;
          const assign = (next: TablePresentation) => {
            state = next;
            set(next);
          };
          const changePlayer = (
            id: string,
            change: Partial<TablePresentation["players"][number]>,
          ) =>
            assign({
              ...state,
              players: state.players.map((p) =>
                p.id === id ? { ...p, ...change } : p,
              ),
            });
          const fly = async (packets: Omit<Flight, "id">[], duration = 320) => {
            setFlights(
              pref.current
                ? []
                : packets.map((p) => ({ ...p, id: ++serial.current })),
            );
            await pause(pref.current ? 15 : duration, own.signal);
            setFlights([]);
          };
          for (const event of packet.events) {
            if (own.signal.aborted) return;
            const d = event.data;
            if (d.type === "HAND_STARTED") {
              const next = fromSnapshot(packet);
              assign({
                ...next,
                players: next.players.map((p) => ({
                  ...p,
                  stack:
                    state.players.find((old) => old.id === p.id)?.stack ??
                    p.stack,
                  bet: 0,
                  cards: [],
                  revealed: false,
                  folded: false,
                  hand: null,
                  action: "Ready",
                })),
                board: [],
                pot: 0,
                pots: [],
                winner: null,
                winners: [],
                awarded: 0,
                awards: {},
              });
            } else if (d.type === "BLIND_POSTED" || d.type === "ACTION") {
              const p = state.players.find((p) => p.id === d.playerId);
              if (!p) continue;
              const paid = d.type === "ACTION" ? d.paid : d.amount;
              changePlayer(p.id, {
                stack: p.stack - paid,
                bet: d.type === "ACTION" ? d.streetTotal : p.bet + paid,
                folded:
                  d.type === "ACTION" && d.action === "FOLD" ? true : p.folded,
                action:
                  d.type === "ACTION"
                    ? d.action.replace("_TO", "").toLowerCase()
                    : d.blind,
              });
              if (paid > 0)
                await fly(
                  [
                    {
                      kind: "chip",
                      from: `stack-${p.id}`,
                      to: `bet-${p.id}`,
                      amount: paid,
                    },
                  ],
                  260,
                );
            } else if (d.type === "CARDS_DEALT") {
              for (let slot = 0; slot < d.count; slot++) {
                const p = state.players.find((p) => p.id === d.playerId);
                if (!p) continue;
                changePlayer(p.id, { cards: [...p.cards, unknownCard()] });
                await fly(
                  [{ kind: "card", from: "deck", to: `seat-${p.id}-${slot}` }],
                  240,
                );
              }
            } else if (
              d.type === "HOLE_CARDS" &&
              event.visibility === "PRIVATE"
            ) {
              changePlayer(event.recipientId, {
                cards: d.cards.map(visualCard),
                revealed: true,
                hand: handHint(d.cards, []),
              });
            } else if (d.type === "HOLE_CARDS_REVEALED") {
              changePlayer(d.playerId, {
                cards: d.cards.map(visualCard),
                revealed: true,
              });
              await pause(pref.current ? 10 : 180, own.signal);
            } else if (d.type === "UNCALLED_RETURNED") {
              const p = state.players.find((p) => p.id === d.playerId);
              if (p)
                changePlayer(p.id, {
                  stack: p.stack + d.amount,
                  bet: Math.max(0, p.bet - d.amount),
                });
            } else if (d.type === "BETTING_ROUND_CLOSED") {
              await fly(
                state.players
                  .filter((p) => p.bet > 0)
                  .map((p) => ({
                    kind: "chip" as const,
                    from: `bet-${p.id}` as const,
                    to: "pot" as const,
                    amount: p.bet,
                  })),
                280,
              );
              assign({
                ...state,
                pot: d.total,
                pots:
                  d.pots.length > 1
                    ? d.pots.map((p, i) => ({
                        ...p,
                        label: i === 0 ? "Main pot" : `Side pot ${i}`,
                      }))
                    : [],
                players: state.players.map((p) => ({ ...p, bet: 0 })),
              });
            } else if (d.type === "BOARD_DEALT") {
              for (const card of d.cards) {
                const slot = state.board.length;
                assign({
                  ...state,
                  board: [
                    ...state.board,
                    { card: visualCard(card), revealed: false },
                  ],
                });
                await fly(
                  [{ kind: "card", from: "deck", to: `board-${slot}` }],
                  300,
                );
                assign({
                  ...state,
                  board: state.board.map((b, i) =>
                    i === slot ? { ...b, revealed: true } : b,
                  ),
                });
                await pause(pref.current ? 10 : 130, own.signal);
              }
            } else if (d.type === "SHOWDOWN") {
              assign({
                ...state,
                players: state.players.map((p) => {
                  const h = d.hands.find((h) => h.playerId === p.id);
                  return h
                    ? {
                        ...p,
                        cards: h.cards.map(visualCard),
                        revealed: true,
                        hand: valueHint(h.value),
                      }
                    : p;
                }),
              });
              await pause(pref.current ? 10 : 350, own.signal);
            } else if (d.type === "POT_AWARDED") {
              const awards = { ...state.awards };
              for (const share of d.pot.shares)
                awards[share.playerId] =
                  (awards[share.playerId] ?? 0) + share.amount;
              assign({
                ...state,
                winners: Object.keys(awards),
                winner: Object.keys(awards)[0] ?? null,
                awards,
              });
              await fly(
                d.pot.shares.map((s) => ({
                  kind: "chip" as const,
                  from: "pot" as const,
                  to: `stack-${s.playerId}` as const,
                  amount: s.amount,
                })),
                340,
              );
              assign({
                ...state,
                pot: Math.max(0, state.pot - d.pot.amount),
                players: state.players.map((p) => ({
                  ...p,
                  stack:
                    p.stack +
                    (d.pot.shares.find((s) => s.playerId === p.id)?.amount ??
                      0),
                })),
              });
            }
          }
          assign(fromSnapshot(packet, state));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          const latest = queue.current.at(-1) ?? snapshot!;
          set(fromSnapshot(latest));
          queue.current = [];
        }
      } finally {
        if (controller.current === own) {
          controller.current = null;
          setBusy(false);
          setFlights([]);
        }
      }
    }
    void run();
  }, [snapshot]);
  return { presentation, flights, busy };
}
