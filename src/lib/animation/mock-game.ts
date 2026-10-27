export type SeatId = "you" | "alex" | "sam";
export type Card = { rank: string; suit: string };
export type Pot = {
  id: string;
  label: string;
  amount: number;
  eligible: SeatId[];
};
export type HandHint = { label: string; detail: string; madeCards: string[] };
export const cardKey = (card: Card) => `${card.rank}${card.suit}`;
export type Player = {
  id: SeatId;
  name: string;
  stack: number;
  bet: number;
  cards: Card[];
  folded: boolean;
  revealed: boolean;
  action: string;
  hand: HandHint | null;
};
export type GameState = {
  players: Player[];
  board: { card: Card; revealed: boolean }[];
  pot: number;
  pots: Pot[];
  winner: SeatId | null;
  awarded: number;
};
export type GameEvent =
  | { type: "deal"; seat: SeatId; card: Card; slot: number }
  | {
      type: "action";
      seat: SeatId;
      action: "Bet" | "Raise" | "Call";
      amount: number;
    }
  | { type: "check"; seat: SeatId }
  | { type: "collect" }
  | { type: "board-deal"; card: Card; slot: number }
  | { type: "board-reveal"; slot: number }
  | { type: "fold"; seat: SeatId; reveal?: boolean }
  | { type: "side-pots"; pots: Pot[] }
  | { type: "showdown"; winner: SeatId }
  | { type: "award" }
  | { type: "hand-hints"; hands: Record<SeatId, HandHint> }
  | { type: "reset" };
export function initialGame(): GameState {
  return {
    players: (["you", "alex", "sam"] as SeatId[]).map((id, i) => ({
      id,
      name: ["You", "Alex", "Sam"][i],
      stack: [200, 200, 80][i],
      bet: 0,
      cards: [],
      folded: false,
      revealed: id === "you",
      action: "Ready",
      hand: null,
    })),
    board: [],
    pot: 0,
    pots: [],
    winner: null,
    awarded: 0,
  };
}
// Presentation-only state projection. No betting legality, hand evaluation, or pot calculation.
// ACTION.amount is additional chips committed, not a total raise-to amount.
export function gameReducer(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case "reset":
      return initialGame();
    case "deal":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === event.seat
            ? {
                ...p,
                cards: p.cards.toSpliced(event.slot, 1, event.card),
                action: "Dealt in",
              }
            : p,
        ),
      };
    case "action":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === event.seat
            ? {
                ...p,
                stack: p.stack - event.amount,
                bet: p.bet + event.amount,
                action: p.stack === event.amount ? "All in" : event.action,
              }
            : p,
        ),
      };
    case "check":
      return { ...state, players: state.players.map((p) => p.id === event.seat ? { ...p, action: "Check" } : p) };
    case "collect":
      return {
        ...state,
        pot: state.pot + state.players.reduce((sum, p) => sum + p.bet, 0),
        players: state.players.map((p) => ({ ...p, bet: 0 })),
      };
    case "board-deal":
      return {
        ...state,
        board: state.board.toSpliced(event.slot, 1, {
          card: event.card,
          revealed: false,
        }),
      };
    case "board-reveal":
      return {
        ...state,
        board: state.board.map((c, i) =>
          i === event.slot ? { ...c, revealed: true } : c,
        ),
      };
    case "hand-hints":
      return {
        ...state,
        players: state.players.map((p) => ({ ...p, hand: event.hands[p.id] })),
      };
    case "fold":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === event.seat
            ? {
                ...p,
                folded: true,
                revealed: p.revealed || event.reveal === true,
                action: "Folded",
              }
            : p,
        ),
      };
    case "side-pots":
      return { ...state, pots: event.pots };
    case "showdown":
      return {
        ...state,
        winner: event.winner,
        players: state.players.map((p) => ({
          ...p,
          revealed: p.revealed || !p.folded,
          action: p.folded
            ? "Folded"
            : p.id === event.winner
              ? `${p.hand?.label ?? "Best hand"} · winner`
              : (p.hand?.label ?? "Shown"),
        })),
      };
    case "award":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === state.winner ? { ...p, stack: p.stack + state.pot } : p,
        ),
        awarded: state.pot,
        pot: 0,
        pots: [],
      };
  }
}
export type Chapter = {
  label: string;
  description: string;
  events: GameEvent[];
};
const c = (rank: string, suit: string): Card => ({ rank, suit });
const BASE_CHAPTERS: Chapter[] = [
  {
    label: "Deal",
    description: "Two cards each, dealt one seat at a time.",
    events: [
      { type: "deal", seat: "alex", slot: 0, card: c("A", "♠") },
      { type: "deal", seat: "sam", slot: 0, card: c("9", "♠") },
      { type: "deal", seat: "you", slot: 0, card: c("Q", "♥") },
      { type: "deal", seat: "alex", slot: 1, card: c("A", "♦") },
      { type: "deal", seat: "sam", slot: 1, card: c("9", "♦") },
      { type: "deal", seat: "you", slot: 1, card: c("Q", "♠") },
    ],
  },
  {
    label: "Bet / raise / call",
    description: "Small chip movements. Each contribution stays visible.",
    events: [
      { type: "action", seat: "you", action: "Bet", amount: 8 },
      { type: "action", seat: "alex", action: "Call", amount: 8 },
      { type: "action", seat: "sam", action: "Raise", amount: 20 },
      { type: "action", seat: "you", action: "Call", amount: 12 },
      { type: "action", seat: "alex", action: "Call", amount: 12 },
    ],
  },
  {
    label: "Collect to pot",
    description: "The round closes. 60 chips move into the middle.",
    events: [{ type: "collect" }],
  },
  {
    label: "Flop",
    description: "Three community cards arrive and turn face up in order.",
    events: [
      { type: "board-deal", slot: 0, card: c("Q", "♦") },
      { type: "board-reveal", slot: 0 },
      { type: "board-deal", slot: 1, card: c("K", "♥") },
      { type: "board-reveal", slot: 1 },
      { type: "board-deal", slot: 2, card: c("7", "♣") },
      { type: "board-reveal", slot: 2 },
    ],
  },
  {
    label: "Turn",
    description: "One more card. Keep the rhythm unhurried.",
    events: [
      { type: "board-deal", slot: 3, card: c("4", "♥") },
      { type: "board-reveal", slot: 3 },
    ],
  },
  {
    label: "River",
    description: "The final community card completes the board.",
    events: [
      { type: "board-deal", slot: 4, card: c("2", "♣") },
      { type: "board-reveal", slot: 4 },
    ],
  },
  {
    label: "Side pots",
    description: "A supplied all-in fixture: main pot 240, side pot 40.",
    events: [
      { type: "action", seat: "you", action: "Bet", amount: 80 },
      { type: "action", seat: "alex", action: "Call", amount: 80 },
      { type: "action", seat: "sam", action: "Call", amount: 60 },
      { type: "collect" },
      {
        type: "side-pots",
        pots: [
          {
            id: "main",
            label: "Main pot",
            amount: 240,
            eligible: ["you", "alex", "sam"],
          },
          {
            id: "side-1",
            label: "Side pot 1",
            amount: 40,
            eligible: ["you", "alex"],
          },
        ],
      },
    ],
  },
  {
    label: "Fold",
    description:
      "Alex folds. His demo cards stay visible, dimmed and marked Folded.",
    events: [
      { type: "fold", seat: "alex", reveal: true },
      {
        type: "side-pots",
        pots: [
          {
            id: "main",
            label: "Main pot",
            amount: 240,
            eligible: ["you", "sam"],
          },
          { id: "side-1", label: "Side pot 1", amount: 40, eligible: ["you"] },
        ],
      },
    ],
  },
  {
    label: "Showdown",
    description:
      "Reveal the remaining hands. The fixture names you as the winner.",
    events: [{ type: "showdown", winner: "you" }],
  },
  {
    label: "Award",
    description: "280 chips settle into your stack. Ready for another look?",
    events: [{ type: "award" }],
  },
];

// Hand hints are presentation data supplied by the mock producer, not evaluated here.
const pocketHands: Record<SeatId, HandHint> = {
  you: { label: "Pair", detail: "Queens", madeCards: ["Q♥", "Q♠"] },
  alex: { label: "Pair", detail: "Aces", madeCards: ["A♠", "A♦"] },
  sam: { label: "Pair", detail: "Nines", madeCards: ["9♠", "9♦"] },
};
const flopHands: Record<SeatId, HandHint> = {
  ...pocketHands,
  you: {
    label: "Three of a kind",
    detail: "Queens",
    madeCards: ["Q♥", "Q♠", "Q♦"],
  },
};
export const MOCK_CHAPTERS: Chapter[] = BASE_CHAPTERS.map((chapter) => ({
  ...chapter,
  events: chapter.events.flatMap((event): GameEvent[] => {
    if (event.type === "deal" && event.seat === "you" && event.slot === 1)
      return [event, { type: "hand-hints", hands: pocketHands }];
    if (event.type === "board-reveal" && event.slot === 0)
      return [event, { type: "hand-hints", hands: flopHands }];
    return [event];
  }),
}));

export function describeEvent(event: GameEvent): string {
  switch (event.type) {
    case "deal":
      return `Deal card ${event.slot + 1} → ${event.seat}`;
    case "action":
      return `${event.seat}: ${event.action.toLowerCase()} +${event.amount}`;
    case "check":
      return `${event.seat}: check`;
    case "collect":
      return "Collect contributions → pot";
    case "board-deal":
      return `Deal community card ${event.slot + 1}`;
    case "board-reveal":
      return `Reveal community card ${event.slot + 1}`;
    case "fold":
      return `${event.seat} folds`;
    case "side-pots":
      return "Update supplied pot labels";
    case "showdown":
      return `Showdown · winner: ${event.winner}`;
    case "award":
      return "Award pot → winner";
    case "hand-hints":
      return "Update best-hand highlights";
    case "reset":
      return "Reset fixture";
  }
}

// A bounded, branching UI rehearsal. This is not a rules engine: cards, replies,
// turn order and outcomes are authored fixtures. Keep it out of engine code.
export type RehearsalStreet = 0 | 1 | 2 | 3;
export type RehearsalChoice = "fold" | "check-call" | "bet";
export function rehearsalOpening(): GameEvent[] {
  return [
    ...MOCK_CHAPTERS[0].events,
    { type: "action", seat: "alex", action: "Bet", amount: 8 },
    { type: "action", seat: "sam", action: "Call", amount: 8 },
  ];
}
export function rehearsalRound(
  state: GameState,
  street: RehearsalStreet,
  choice: RehearsalChoice,
  amount = 8,
): GameEvent[] {
  if (state.winner || state.players.some((p) => p.cards.length !== 2)) return [];
  const hero = state.players.find((p) => p.id === "you")!;
  if (hero.folded) return [];
  if (choice === "fold") {
    return [
      { type: "fold", seat: "you" },
      { type: "collect" },
      ...[3, 4, 5].slice(street).flatMap((i) => MOCK_CHAPTERS[i].events),
      { type: "showdown", winner: "alex" },
      { type: "award" },
    ];
  }
  // Deliberately small presets keep this rehearsal away from all-in/side-pot rules.
  const target = choice === "bet" ? amount : street === 0 ? 8 : 0;
  const min = street === 0 ? 16 : 4;
  const max = street === 0 ? 24 : 16;
  if (choice === "bet" && (!Number.isInteger(target) || target < min || target > max || target % 2 !== 0)) return [];
  if (state.players.some((p) => target < p.bet || target - p.bet > p.stack)) return [];
  const events: GameEvent[] = state.players.filter((p) => target === 0 || target > p.bet).map((p) => target === 0
    ? { type: "check", seat: p.id }
    : { type: "action", seat: p.id, action: p.id === "you" ? (street === 0 && choice === "bet" ? "Raise" : street === 0 ? "Call" : "Bet") : "Call", amount: target - p.bet });
  events.push({ type: "collect" });
  if (street < 3) events.push(...MOCK_CHAPTERS[street + 3].events);
  else events.push({ type: "showdown", winner: "you" }, { type: "award" });
  return events;
}
