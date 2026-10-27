import type {
  Action,
  ErrorCode,
  GameState,
  LegalActions,
  Player,
  Transition,
} from "./types.js";
export const chips = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
export function failure(
  state: GameState,
  code: ErrorCode,
  message: string,
): Transition {
  return { ok: false, state, events: [], error: { code, message } };
}
export const livePlayers = (state: GameState): Player[] =>
  state.players.filter((p) => p.status === "ACTIVE" || p.status === "ALL_IN");
export const activePlayers = (state: GameState): Player[] =>
  state.players.filter((p) => p.status === "ACTIVE");
/** Physical seat numbers, not array order or mutable display names, determine order. */
export function clockwise<T extends { seat: number }>(
  players: T[],
  after: number,
): T[] {
  return [...players].sort(
    (a, b) => ((a.seat - after + 6) % 6 || 6) - ((b.seat - after + 6) % 6 || 6),
  );
}
export function getLegalActions(
  state: GameState,
  playerId: string,
): LegalActions {
  const none: LegalActions = {
    fold: false,
    check: false,
    call: null,
    bet: null,
    raiseTo: null,
    allIn: null,
    canRaise: false,
  };
  const player = state.players.find((p) => p.id === playerId);
  if (
    !player ||
    state.actorId !== playerId ||
    player.status !== "ACTIVE" ||
    !state.pending.includes(playerId) ||
    !["PREFLOP", "FLOP", "TURN", "RIVER"].includes(state.phase)
  )
    return none;
  const owed = Math.max(0, state.currentBet - player.streetCommitted);
  const maxTo = player.streetCommitted + player.stack;
  const reopened =
    player.reopenAt === null || state.currentBet >= player.reopenAt;
  const canRaise =
    reopened &&
    activePlayers(state).some((p) => p.id !== playerId) &&
    maxTo > state.currentBet;
  const fullMinTo =
    state.currentBet === 0
      ? state.config.bigBlind
      : state.currentBet + state.lastFullRaise;
  const range =
    canRaise && Number.isSafeInteger(fullMinTo)
      ? { minTo: Math.min(fullMinTo, maxTo), maxTo, fullMinTo }
      : null;
  return {
    fold: true,
    check: owed === 0,
    call: owed > 0 ? Math.min(owed, player.stack) : null,
    bet: state.currentBet === 0 ? range : null,
    raiseTo: state.currentBet > 0 ? range : null,
    allIn:
      (maxTo <= state.currentBet && owed > 0) || canRaise
        ? { to: maxTo }
        : null,
    canRaise,
  };
}
export function validateAction(
  state: GameState,
  action: Action,
): { code: ErrorCode; message: string } | null {
  if (
    !action ||
    typeof action !== "object" ||
    typeof action.playerId !== "string"
  )
    return { code: "INVALID_PLAYER", message: "A player ID is required" };
  const legal = getLegalActions(state, action.playerId);
  if (!legal.fold)
    return { code: "NOT_YOUR_TURN", message: "Player is not the active actor" };
  if (
    action.type === "FOLD" ||
    (action.type === "CHECK" && legal.check) ||
    (action.type === "CALL" && legal.call !== null) ||
    (action.type === "ALL_IN" && legal.allIn !== null)
  )
    return null;
  if (action.type === "BET" || action.type === "RAISE_TO") {
    if (!chips(action.to) || action.to === 0)
      return {
        code: "INVALID_AMOUNT",
        message: "Target must be a positive safe integer",
      };
    const range = action.type === "BET" ? legal.bet : legal.raiseTo;
    if (range && action.to >= range.minTo && action.to <= range.maxTo)
      return null;
  }
  return {
    code: "ILLEGAL_ACTION",
    message:
      "Action is unavailable, below the minimum, exceeds the stack, or betting has not reopened",
  };
}
/** Called only on a private working copy after validateAction succeeds. */
export function commitAction(
  state: GameState,
  action: Action,
): { paid: number; fullRaise: boolean } {
  const p = state.players.find((p) => p.id === action.playerId)!;
  const before = state.currentBet;
  let paid = 0;
  if (action.type === "FOLD") p.status = "FOLDED";
  else {
    const target =
      action.type === "CHECK"
        ? p.streetCommitted
        : action.type === "CALL"
          ? Math.min(before, p.streetCommitted + p.stack)
          : action.type === "ALL_IN"
            ? p.streetCommitted + p.stack
            : action.to;
    paid = target - p.streetCommitted;
    p.stack -= paid;
    p.totalCommitted += paid;
    p.streetCommitted = target;
    if (p.stack === 0) p.status = "ALL_IN";
    if (target > before) state.currentBet = target;
  }
  const increment = state.currentBet - before;
  const fullRaise = increment > 0 && increment >= state.lastFullRaise;
  if (fullRaise) state.lastFullRaise = increment;
  // Threshold uses the full increment at the player's most recent action.
  // Several later short all-ins may cross it without changing lastFullRaise.
  p.reopenAt = Math.min(
    Number.MAX_SAFE_INTEGER,
    state.currentBet + state.lastFullRaise,
  );
  state.pending = state.pending.filter((id) => id !== p.id);
  if (increment > 0)
    state.pending = activePlayers(state)
      .filter((q) => q.id !== p.id && q.streetCommitted < state.currentBet)
      .map((q) => q.id);
  return { paid, fullRaise };
}
