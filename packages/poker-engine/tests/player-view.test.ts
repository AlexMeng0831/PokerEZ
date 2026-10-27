import { describe, expect, it } from "vitest";
import {
  getPlayerEvents,
  getPlayerView,
  getPublicEvents,
} from "../src/player-view.js";
import { createHistory, replayHistory } from "../src/history.js";
import { applyAction, startHand } from "../src/game.js";
import { act, start, success, table } from "./helpers.js";
import type { GameEvent } from "../src/types.js";
describe("privacy and deterministic history", () => {
  it("exposes only the viewer's private cards and no deck, burns, seed, or internal history", () => {
    const result = startHand(table());
    if (!result.ok) throw new Error();
    const state = result.state;
    const view = getPlayerView(state, "p0");
    expect(view.players[0].holeCards).toEqual(state.players[0].holeCards);
    expect(view.players[1].holeCards).toBeNull();
    expect(view.players[2].holeCards).toBeNull();
    expect(
      getPlayerView(state).players.every((p) => p.holeCards === null),
    ).toBe(true);
    for (const key of [
      "deck",
      "deckCursor",
      "burns",
      "actionHistory",
      "pending",
      "startingChips",
    ])
      expect(view).not.toHaveProperty(key);
    expect(view.config).not.toHaveProperty("shuffleSeed");
    const publicEvents = getPublicEvents(result.events);
    expect(publicEvents.every((e) => e.visibility === "PUBLIC")).toBe(true);
    expect(JSON.stringify(publicEvents)).not.toMatch(
      /HOLE_CARDS|DECK_ORDER|BURN_CARD/,
    );
    const own = getPlayerEvents(result.events, "p0");
    expect(own.filter((e) => e.visibility === "PRIVATE")).toHaveLength(1);
    expect(
      own.every((e) => e.visibility === "PUBLIC" || e.recipientId === "p0"),
    ).toBe(true);
    view.players[0].holeCards![0].rank = 2;
    expect(getPlayerView(state, "p0")).not.toEqual(view);
  });
  it("does not expose a folded player's hole cards at showdown", () => {
    let s = start();
    s = act(s, "FOLD");
    while (s.phase !== "FINISHED") {
      const p = s.players.find((p) => p.id === s.actorId)!;
      s = act(s, p.streetCommitted < s.currentBet ? "CALL" : "CHECK");
    }
    expect(getPlayerView(s).players[0].holeCards).toBeNull();
    expect(
      getPlayerView(s)
        .players.slice(1)
        .every((p) => p.holeCards!.length === 2),
    ).toBe(true);
    expect(s.result!.hands.map((h) => h.playerId)).not.toContain("p0");
  });
  it("reproduces the full state and all event sequences from JSON round-tripped history", () => {
    const initial = table([200, 50, 100]);
    const begin = startHand(initial);
    let s = success(begin);
    const events: GameEvent[] = [...begin.events];
    for (const type of ["ALL_IN", "CALL", "CALL"] as const) {
      const result = applyAction(s, { playerId: s.actorId!, type });
      s = success(result);
      events.push(...result.events);
    }
    const history = createHistory(initial, s);
    const replay = replayHistory(JSON.parse(JSON.stringify(history)));
    expect(replay.state).toEqual(s);
    expect(replay.events).toEqual(events);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(events.every((e) => e.handId === s.handId)).toBe(true);
    history.actions[0].revision++;
    expect(() => replayHistory(history)).toThrow();
  });
  it("event projections are detached from both internal state and the input stream", () => {
    const result = startHand(table());
    const state = success(result);
    const beforeDeck = structuredClone(state.deck);
    const started = result.events.find(
      (e) => e.visibility === "INTERNAL" && e.data.type === "DECK_ORDER",
    )!;
    if (started.visibility === "INTERNAL" && started.data.type === "DECK_ORDER")
      started.data.cards[0].rank = 2;
    expect(state.deck).toEqual(beforeDeck);
    const events = getPublicEvents(result.events);
    const before = structuredClone(result.events);
    events[0].revision = -1;
    expect(result.events).toEqual(before);
  });
});

it("an all-in call reveals only live hands before runout, never a folded hand", () => {
  let s = start([1000, 50, 100]);
  s = act(s, "FOLD");
  s = act(s, "ALL_IN");
  const transition = applyAction(s, { type: "CALL", playerId: s.actorId! });
  s = success(transition);
  const events = getPublicEvents(transition.events);
  const revealed = events.filter((e) => e.data.type === "HOLE_CARDS_REVEALED");
  expect(
    revealed.map((e) =>
      e.data.type === "HOLE_CARDS_REVEALED" ? e.data.playerId : "",
    ),
  ).toEqual(["p1", "p2"]);
  expect(revealed.at(-1)!.seq).toBeLessThan(
    events.find((e) => e.data.type === "BOARD_DEALT")!.seq,
  );
  expect(getPlayerView(s).players[0].holeCards).toBeNull();
});
it("ignores non-action payload fields instead of recording non-serializable data", () => {
  const s = start();
  const result = applyAction(s, {
    type: "CALL",
    playerId: "p0",
    callback: () => {},
  } as never);
  expect(success(result).actionHistory[0].action).toEqual({
    type: "CALL",
    playerId: "p0",
  });
});
