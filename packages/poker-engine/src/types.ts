export type PlayerId = string;
export type SeatId = number;
export type Suit = "c" | "d" | "h" | "s";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type Card = { rank: Rank; suit: Suit };
export type Phase =
  "WAITING" | "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN" | "FINISHED";
export type HandCategory =
  | "HIGH_CARD"
  | "ONE_PAIR"
  | "TWO_PAIR"
  | "THREE_OF_A_KIND"
  | "STRAIGHT"
  | "FLUSH"
  | "FULL_HOUSE"
  | "FOUR_OF_A_KIND"
  | "STRAIGHT_FLUSH"
  | "ROYAL_FLUSH";
export type HandValue = {
  category: HandCategory;
  rank: number;
  kickers: number[];
  bestFive: Card[];
};
export type Config = {
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  shuffleSeed: number;
};
export type Player = {
  id: PlayerId;
  seat: SeatId;
  name: string;
  stack: number;
  sittingOut: boolean;
  status: "WAITING" | "ACTIVE" | "FOLDED" | "ALL_IN";
  holeCards: Card[];
  revealed: boolean;
  streetCommitted: number;
  totalCommitted: number;
  /** An acted player's raise right reopens only at this street bet level. */
  reopenAt: number | null;
};
export type Action = { playerId: PlayerId } & (
  | { type: "FOLD" }
  | { type: "CHECK" }
  | { type: "CALL" }
  | { type: "ALL_IN" }
  | { type: "BET" | "RAISE_TO"; to: number }
);
export type Pot = {
  id: string;
  amount: number;
  cap: number;
  contributors: PlayerId[];
  eligible: PlayerId[];
};
export type PotResult = Pot & {
  winners: PlayerId[];
  shares: { playerId: PlayerId; amount: number }[];
};
export type HandResult = {
  reason: "SHOWDOWN" | "UNCONTESTED";
  pots: PotResult[];
  contributions: { playerId: PlayerId; amount: number }[];
  hands: { playerId: PlayerId; value: HandValue }[];
};
export type RecordedAction = { revision: number; action: Action };
/** Trusted internal state. Never send this object to a client. */
export type GameState = {
  tableId: string;
  config: Config;
  players: Player[];
  phase: Phase;
  handNo: number;
  handId: string;
  buttonSeat: SeatId | null;
  smallBlindSeat: SeatId | null;
  bigBlindSeat: SeatId | null;
  bigBlindPlayerId: PlayerId | null;
  actorId: PlayerId | null;
  pending: PlayerId[];
  currentBet: number;
  lastFullRaise: number;
  deck: Card[];
  deckCursor: number;
  burns: Card[];
  board: Card[];
  revision: number;
  sequence: number;
  startingChips: number;
  pots: Pot[];
  result: HandResult | null;
  actionHistory: RecordedAction[];
};
export type PublicData =
  | {
      type: "HAND_STARTED";
      buttonSeat: SeatId;
      smallBlindSeat: SeatId;
      bigBlindSeat: SeatId;
    }
  | {
      type: "BLIND_POSTED";
      playerId: PlayerId;
      blind: "SB" | "BB";
      amount: number;
    }
  | { type: "CARDS_DEALT"; playerId: PlayerId; count: number }
  | {
      type: "ACTION";
      playerId: PlayerId;
      action: Action["type"];
      paid: number;
      streetTotal: number;
      fullRaise: boolean;
    }
  | { type: "STREET_STARTED"; phase: Phase }
  | { type: "BOARD_DEALT"; cards: Card[] }
  | { type: "BETTING_ROUND_CLOSED"; pots: Pot[]; total: number }
  | { type: "HOLE_CARDS_REVEALED"; playerId: PlayerId; cards: Card[] }
  | { type: "UNCALLED_RETURNED"; playerId: PlayerId; amount: number }
  | {
      type: "SHOWDOWN";
      hands: { playerId: PlayerId; cards: Card[]; value: HandValue }[];
    }
  | { type: "POT_AWARDED"; pot: PotResult }
  | { type: "HAND_FINISHED"; result: HandResult }
  | { type: "TABLE_UPDATED"; command: TableCommand };
export type EventMeta = { handId: string; seq: number; revision: number };
export type PublicEvent = EventMeta & {
  visibility: "PUBLIC";
  data: PublicData;
};
export type PrivateEvent = EventMeta & {
  visibility: "PRIVATE";
  recipientId: PlayerId;
  data: { type: "HOLE_CARDS"; cards: Card[] };
};
export type InternalEvent = EventMeta & {
  visibility: "INTERNAL";
  data:
    { type: "DECK_ORDER"; cards: Card[] } | { type: "BURN_CARD"; card: Card };
};
export type GameEvent = PublicEvent | PrivateEvent | InternalEvent;
export type ErrorCode =
  | "HAND_IN_PROGRESS"
  | "NOT_ENOUGH_PLAYERS"
  | "INVALID_DECK"
  | "NOT_YOUR_TURN"
  | "ILLEGAL_ACTION"
  | "INVALID_AMOUNT"
  | "INVALID_PLAYER"
  | "INVALID_TABLE_CHANGE"
  | "NOT_SETTLEABLE"
  | "STALE_REVISION";
export type Transition =
  | { ok: true; state: GameState; events: GameEvent[] }
  | {
      ok: false;
      state: GameState;
      events: [];
      error: { code: ErrorCode; message: string };
    };
export type BetRange = { minTo: number; maxTo: number; fullMinTo: number };
export type LegalActions = {
  fold: boolean;
  check: boolean;
  call: number | null;
  bet: BetRange | null;
  raiseTo: BetRange | null;
  allIn: { to: number } | null;
  canRaise: boolean;
};
export type TableCommand =
  | {
      type: "JOIN";
      player: { id: PlayerId; seat: SeatId; name?: string; stack?: number };
    }
  | { type: "LEAVE"; playerId: PlayerId }
  | { type: "SIT_OUT"; playerId: PlayerId; sittingOut: boolean }
  | { type: "TOP_UP"; playerId: PlayerId; amount: number };
