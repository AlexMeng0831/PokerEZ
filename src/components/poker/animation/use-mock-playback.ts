"use client";
import { useEffect, useRef, useState } from "react";
import {
  MOCK_CHAPTERS,
  describeEvent,
  gameReducer,
  initialGame,
  type GameEvent,
} from "@/lib/animation/mock-game";
import type { Flight } from "./primitives";
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
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
}
export function useMockPlayback({
  reduced,
  speed,
}: {
  reduced: boolean;
  speed: number;
}) {
  const [state, setState] = useState(initialGame);
  const current = useRef(state);
  const preferences = useRef({ reduced, speed });
  preferences.current = { reduced, speed };
  const [flights, setFlights] = useState<Flight[]>([]);
  const [completed, setCompleted] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<{ id: number; text: string }[]>([]);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const serial = useRef(0);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  function dispatch(event: GameEvent) {
    current.current = gameReducer(current.current, event);
    setState(current.current);
  }
  function reset() {
    controller.current?.abort();
    controller.current = null;
    dispatch({ type: "reset" });
    setFlights([]);
    setCompleted(0);
    setActive(null);
    setRunning(false);
    setLogs([]);
    setError("");
  }
  async function playEvent(event: GameEvent, signal: AbortSignal) {
    const { reduced, speed } = preferences.current;
    const id = () => ++serial.current;
    let packets: Flight[] = [];
    if (event.type === "deal")
      packets = [
        {
          id: id(),
          kind: "card",
          from: "deck",
          to: `seat-${event.seat}-${event.slot}`,
        },
      ];
    if (event.type === "board-deal")
      packets = [
        { id: id(), kind: "card", from: "deck", to: `board-${event.slot}` },
      ];
    if (event.type === "action")
      packets = [
        {
          id: id(),
          kind: "chip",
          from: `stack-${event.seat}`,
          to: `bet-${event.seat}`,
          amount: event.amount,
        },
      ];
    if (event.type === "collect")
      packets = current.current.players
        .filter((p) => p.bet > 0)
        .map((p) => ({
          id: id(),
          kind: "chip",
          from: `bet-${p.id}`,
          to: "pot",
          amount: p.bet,
        }));
    if (event.type === "award" && current.current.winner)
      packets = [
        {
          id: id(),
          kind: "chip",
          from: "pot",
          to: `stack-${current.current.winner}`,
          amount: current.current.pot,
        },
      ];
    const afterTravel = event.type === "collect" || event.type === "award";
    setLogs((l) =>
      [{ id: id(), text: describeEvent(event) }, ...l].slice(0, 8),
    );
    if (!afterTravel) dispatch(event);
    setFlights(reduced ? [] : packets);
    await wait(
      reduced
        ? 110
        : (event.type === "deal"
            ? 270
            : packets.length
              ? 540
              : event.type === "showdown"
                ? 650
                : 450) / speed,
      signal,
    );
    if (afterTravel) dispatch(event);
    setFlights([]);
    if (event.type !== "deal") await wait(reduced ? 40 : 150 / speed, signal);
  }
  async function play(all: boolean) {
    if (controller.current || completed === MOCK_CHAPTERS.length) return;
    const own = new AbortController();
    controller.current = own;
    setRunning(true);
    setError("");
    try {
      for (
        let i = completed;
        i < (all ? MOCK_CHAPTERS.length : completed + 1);
        i++
      ) {
        setActive(i);
        for (const event of MOCK_CHAPTERS[i].events)
          await playEvent(event, own.signal);
        setCompleted(i + 1);
        if (all) await wait(reduced ? 80 : 450 / speed, own.signal);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setError("The preview stopped. Reset and try again.");
    } finally {
      if (controller.current === own) {
        controller.current = null;
        setRunning(false);
        setFlights([]);
      }
    }
  }
  // Adapters can await event batches through the exact same visual pipeline.
  // Validity, pot eligibility and winners remain the producer's responsibility.
  async function playEvents(events: GameEvent[]) {
    if (controller.current)
      throw new Error("Await the previous event batch before sending another.");
    const own = new AbortController();
    controller.current = own;
    setRunning(true);
    try {
      for (const event of events) await playEvent(event, own.signal);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        throw error;
    } finally {
      if (controller.current === own) {
        controller.current = null;
        setRunning(false);
        setFlights([]);
      }
    }
  }
  return {
    state,
    flights,
    completed,
    active,
    running,
    logs,
    error,
    reset,
    play,
    playEvents,
  };
}
