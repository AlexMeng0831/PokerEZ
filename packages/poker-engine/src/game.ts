import {
  activePlayers,
  chips,
  clockwise,
  commitAction,
  failure,
  livePlayers,
  validateAction,
} from "./betting.js";
import {
  createDeck,
  draw,
  seededRandom,
  shuffleDeck,
  validateCards,
} from "./deck.js";
import { emitPublic } from "./events.js";
import { buildPots, refundUncalled, settleWorking } from "./pots.js";
import type {
  Action,
  Config,
  Card,
  GameEvent,
  GameState,
  Player,
  TableCommand,
  Transition,
} from "./types.js";
export type PlayerInput = {
  id: string;
  seat: number;
  name?: string;
  stack?: number;
  sittingOut?: boolean;
};
const DEFAULTS: Config = {
  smallBlind: 5,
  bigBlind: 10,
  startingStack: 1000,
  shuffleSeed: 1,
};
function newPlayer(input: PlayerInput, config: Config): Player {
  return {
    id: input.id,
    seat: input.seat,
    name: input.name ?? input.id,
    stack: input.stack ?? config.startingStack,
    sittingOut: input.sittingOut ?? false,
    status: "WAITING",
    holeCards: [],
    revealed: false,
    streetCommitted: 0,
    totalCommitted: 0,
    reopenAt: null,
  };
}
function validRoster(players: Player[]): boolean {
  return (
    players.length <= 6 &&
    new Set(players.map((p) => p.id)).size === players.length &&
    new Set(players.map((p) => p.seat)).size === players.length &&
    players.every(
      (p) =>
        typeof p.id === "string" &&
        p.id.length > 0 &&
        typeof p.name === "string" &&
        typeof p.sittingOut === "boolean" &&
        Number.isInteger(p.seat) &&
        p.seat >= 0 &&
        p.seat < 6 &&
        chips(p.stack),
    ) &&
    chips(players.reduce((n, p) => n + p.stack, 0))
  );
}
export function createTable(
  inputs: PlayerInput[],
  config: Partial<Config> = {},
  tableId = "table",
): GameState {
  const rules = { ...DEFAULTS, ...config };
  if (
    !chips(rules.smallBlind) ||
    rules.smallBlind === 0 ||
    !chips(rules.bigBlind) ||
    rules.bigBlind < rules.smallBlind ||
    !chips(rules.startingStack) ||
    rules.startingStack === 0 ||
    !Number.isSafeInteger(rules.shuffleSeed) ||
    !tableId
  )
    throw new RangeError("Invalid table configuration");
  const players = inputs.map((p) => newPlayer(p, rules));
  if (!validRoster(players))
    throw new RangeError(
      "Use up to six distinct players/seats (0–5), with safe integer chip totals",
    );
  return {
    tableId,
    config: rules,
    players,
    phase: "WAITING",
    handNo: 0,
    handId: "",
    buttonSeat: null,
    smallBlindSeat: null,
    bigBlindSeat: null,
    bigBlindPlayerId: null,
    actorId: null,
    pending: [],
    currentBet: 0,
    lastFullRaise: rules.bigBlind,
    deck: [],
    deckCursor: 0,
    burns: [],
    board: [],
    revision: 0,
    sequence: 0,
    startingChips: players.reduce((n, p) => n + p.stack, 0),
    pots: [],
    result: null,
    actionHistory: [],
  };
}
function take(state: GameState, count = 1): Card[] {
  const next = draw(state.deck, state.deckCursor, count);
  state.deckCursor = next.cursor;
  return next.cards;
}
function nextStreet(state: GameState, events: GameEvent[]): void {
  const phase =
    state.phase === "PREFLOP"
      ? "FLOP"
      : state.phase === "FLOP"
        ? "TURN"
        : "RIVER";
  state.phase = phase;
  state.currentBet = 0;
  state.lastFullRaise = state.config.bigBlind;
  for (const p of state.players) {
    p.streetCommitted = 0;
    p.reopenAt = null;
  }
  emitPublic(state, events, { type: "STREET_STARTED", phase });
  const burn = take(state)[0];
  state.burns.push(burn);
  events.push({
    handId: state.handId,
    seq: ++state.sequence,
    revision: state.revision,
    visibility: "INTERNAL",
    data: { type: "BURN_CARD", card: burn },
  });
  const cards = take(state, phase === "FLOP" ? 3 : 1);
  state.board.push(...cards);
  emitPublic(state, events, { type: "BOARD_DEALT", cards });
  state.pending = activePlayers(state).map((p) => p.id);
}
/** Drain forced transitions atomically; animation timing belongs to consumers. */
function progress(
  state: GameState,
  events: GameEvent[],
  afterSeat: number,
): void {
  for (;;) {
    if (livePlayers(state).length === 1) {
      settleWorking(state, events);
      return;
    }
    const active = activePlayers(state);
    state.pending = state.pending.filter((id) =>
      active.some((p) => p.id === id),
    );
    if (active.length === 1) {
      const p = active[0];
      // A lone player can only respond to a live all-in, never bet a dry side pot.
      const opposingBet = Math.max(
        0,
        ...livePlayers(state)
          .filter((q) => q.id !== p.id)
          .map((q) => q.streetCommitted),
      );
      state.currentBet = Math.min(state.currentBet, opposingBet);
      state.pending = p.streetCommitted < state.currentBet ? [p.id] : [];
    }
    if (state.pending.length) {
      state.actorId = clockwise(
        active.filter((p) => state.pending.includes(p.id)),
        afterSeat,
      )[0].id;
      return;
    }
    state.actorId = null;
    refundUncalled(state, events);
    state.pots = buildPots(state);
    emitPublic(state, events, {
      type: "BETTING_ROUND_CLOSED",
      pots: state.pots,
      total: state.players.reduce((n, p) => n + p.totalCommitted, 0),
    });
    if (state.phase === "RIVER") {
      settleWorking(state, events);
      return;
    }
    if (activePlayers(state).length <= 1) {
      for (const p of livePlayers(state))
        if (!p.revealed) {
          p.revealed = true;
          emitPublic(state, events, {
            type: "HOLE_CARDS_REVEALED",
            playerId: p.id,
            cards: p.holeCards.map((c) => ({ ...c })),
          });
        }
    }
    nextStreet(state, events);
    afterSeat = state.buttonSeat!;
  }
}
export function startHand(
  state: GameState,
  deck?: readonly Card[],
): Transition {
  if (state.phase !== "WAITING" && state.phase !== "FINISHED")
    return failure(state, "HAND_IN_PROGRESS", "Finish the current hand first");
  const ready = state.players.filter((p) => !p.sittingOut && p.stack > 0);
  if (ready.length < 2)
    return failure(
      state,
      "NOT_ENOUGH_PLAYERS",
      "At least two funded, ready players are required",
    );
  const order =
    deck ??
    shuffleDeck(
      createDeck(),
      seededRandom(state.config.shuffleSeed + state.handNo),
    );
  if (!validateCards(order))
    return failure(
      state,
      "INVALID_DECK",
      "A complete, unique 52-card deck is required",
    );
  const next = structuredClone(state);
  next.revision++;
  next.handNo++;
  next.handId = `${state.tableId}:${next.handNo}`;
  next.sequence = 0;
  next.phase = "PREFLOP";
  next.result = null;
  next.pots = [];
  next.board = [];
  next.burns = [];
  next.deck = order.map((c) => ({ ...c }));
  next.deckCursor = 0;
  next.actionHistory = [];
  next.startingChips = next.players.reduce((n, p) => n + p.stack, 0);
  for (const p of next.players) {
    p.status = p.sittingOut || p.stack === 0 ? "WAITING" : "ACTIVE";
    p.holeCards = [];
    p.revealed = false;
    p.streetCommitted = 0;
    p.totalCommitted = 0;
    p.reopenAt = null;
  }
  const playing = activePlayers(next);
  next.buttonSeat = clockwise(playing, state.buttonSeat ?? 5)[0].seat;
  next.smallBlindSeat =
    playing.length === 2
      ? next.buttonSeat
      : clockwise(playing, next.buttonSeat)[0].seat;
  next.bigBlindSeat = clockwise(playing, next.smallBlindSeat)[0].seat;
  // On entry to heads-up, avoid giving the surviving prior BB consecutive BBs.
  if (
    playing.length === 2 &&
    state.handNo > 0 &&
    playing.find((p) => p.seat === next.bigBlindSeat)!.id ===
      state.bigBlindPlayerId
  ) {
    next.buttonSeat = next.bigBlindSeat;
    next.smallBlindSeat = next.buttonSeat;
    next.bigBlindSeat = clockwise(playing, next.buttonSeat)[0].seat;
  }
  next.bigBlindPlayerId = playing.find((p) => p.seat === next.bigBlindSeat)!.id;
  next.currentBet = next.config.bigBlind;
  next.lastFullRaise = next.config.bigBlind;
  const events: GameEvent[] = [];
  emitPublic(next, events, {
    type: "HAND_STARTED",
    buttonSeat: next.buttonSeat,
    smallBlindSeat: next.smallBlindSeat,
    bigBlindSeat: next.bigBlindSeat,
  });
  events.push({
    handId: next.handId,
    seq: ++next.sequence,
    revision: next.revision,
    visibility: "INTERNAL",
    data: { type: "DECK_ORDER", cards: next.deck.map((c) => ({ ...c })) },
  });
  emitPublic(next, events, { type: "STREET_STARTED", phase: "PREFLOP" });
  for (const [seat, blind, value] of [
    [next.smallBlindSeat, "SB", next.config.smallBlind],
    [next.bigBlindSeat, "BB", next.config.bigBlind],
  ] as const) {
    const p = next.players.find((p) => p.seat === seat)!;
    const amount = Math.min(value, p.stack);
    p.stack -= amount;
    p.streetCommitted = amount;
    p.totalCommitted = amount;
    if (!p.stack) p.status = "ALL_IN";
    emitPublic(next, events, {
      type: "BLIND_POSTED",
      playerId: p.id,
      blind,
      amount,
    });
  }
  const dealing = clockwise(playing, next.buttonSeat);
  for (let round = 0; round < 2; round++)
    for (const p of dealing) p.holeCards.push(take(next)[0]);
  for (const p of dealing) {
    emitPublic(next, events, { type: "CARDS_DEALT", playerId: p.id, count: 2 });
    events.push({
      handId: next.handId,
      seq: ++next.sequence,
      revision: next.revision,
      visibility: "PRIVATE",
      recipientId: p.id,
      data: { type: "HOLE_CARDS", cards: p.holeCards.map((c) => ({ ...c })) },
    });
  }
  next.pending = activePlayers(next).map((p) => p.id);
  progress(next, events, next.bigBlindSeat);
  return { ok: true, state: next, events };
}
export function applyAction(
  state: GameState,
  action: Action,
  expectedRevision = state.revision,
): Transition {
  if (expectedRevision !== state.revision)
    return failure(state, "STALE_REVISION", "State revision has changed");
  const invalid = validateAction(state, action);
  if (invalid) return failure(state, invalid.code, invalid.message);
  const next = structuredClone(state);
  next.revision++;
  const { paid, fullRaise } = commitAction(next, action);
  const recorded: Action =
    action.type === "BET" || action.type === "RAISE_TO"
      ? { playerId: action.playerId, type: action.type, to: action.to }
      : { playerId: action.playerId, type: action.type };
  next.actionHistory.push({ revision: next.revision, action: recorded });
  const events: GameEvent[] = [];
  const p = next.players.find((p) => p.id === action.playerId)!;
  emitPublic(next, events, {
    type: "ACTION",
    playerId: p.id,
    action: action.type,
    paid,
    streetTotal: p.streetCommitted,
    fullRaise,
  });
  progress(next, events, p.seat);
  return { ok: true, state: next, events };
}
export function updateTable(
  state: GameState,
  command: TableCommand,
): Transition {
  if (state.phase !== "WAITING" && state.phase !== "FINISHED")
    return failure(
      state,
      "HAND_IN_PROGRESS",
      "Table changes are allowed only between hands",
    );
  if (
    !command ||
    typeof command !== "object" ||
    !["JOIN", "LEAVE", "SIT_OUT", "TOP_UP"].includes(command.type)
  )
    return failure(state, "INVALID_TABLE_CHANGE", "Unknown table command");
  if (
    command.type === "JOIN" &&
    (!command.player || typeof command.player !== "object")
  )
    return failure(state, "INVALID_TABLE_CHANGE", "A player is required");
  const next = structuredClone(state);
  if (command.type === "JOIN")
    next.players.push(newPlayer(command.player, next.config));
  else {
    const p = next.players.find((p) => p.id === command.playerId);
    if (!p) return failure(state, "INVALID_PLAYER", "Unknown player");
    if (command.type === "LEAVE")
      next.players = next.players.filter((q) => q.id !== p.id);
    else if (command.type === "SIT_OUT") p.sittingOut = command.sittingOut;
    else if (
      command.type === "TOP_UP" &&
      chips(command.amount) &&
      command.amount > 0
    )
      p.stack += command.amount;
    else
      return failure(
        state,
        "INVALID_TABLE_CHANGE",
        "Top-up must be a positive safe integer",
      );
  }
  if (!validRoster(next.players))
    return failure(
      state,
      "INVALID_TABLE_CHANGE",
      "Invalid player, seat, or chip total",
    );
  next.revision++;
  next.startingChips = next.players.reduce((n, p) => n + p.stack, 0);
  const events: GameEvent[] = [];
  emitPublic(next, events, {
    type: "TABLE_UPDATED",
    command: structuredClone(command),
  });
  return { ok: true, state: next, events };
}
