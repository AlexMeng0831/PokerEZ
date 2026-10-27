import { applyAction, startHand } from "./game.js";
import type { Card, GameEvent, GameState, RecordedAction } from "./types.js";
/** Privileged replay artifact: contains the entire deck. Never broadcast this. */
export type HandHistory = {
  version: 1;
  initialState: GameState;
  deck: Card[];
  actions: RecordedAction[];
};
export function replayHistory(history: HandHistory): {
  state: GameState;
  events: GameEvent[];
} {
  if (history.version !== 1)
    throw new RangeError("Unsupported history version");
  const started = startHand(history.initialState, history.deck);
  if (!started.ok) throw new Error(`Cannot replay: ${started.error.message}`);
  let state = started.state;
  const events = [...started.events];
  for (const record of history.actions) {
    const result = applyAction(state, record.action, record.revision - 1);
    if (!result.ok)
      throw new Error(
        `Invalid history revision ${record.revision}: ${result.error.message}`,
      );
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
export function createHistory(
  initialState: GameState,
  state: GameState,
): HandHistory {
  const history: HandHistory = structuredClone({
    version: 1,
    initialState,
    deck: state.deck,
    actions: state.actionHistory,
  });
  const replayed = replayHistory(history).state;
  if (JSON.stringify(replayed) !== JSON.stringify(state))
    throw new Error(
      "Initial snapshot and action history do not reproduce this state",
    );
  return history;
}
