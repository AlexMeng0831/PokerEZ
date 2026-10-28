export type VisualCard = { rank: string; suit: string };
export type VisualHand = { label: string; detail: string; madeCards: string[] };
export type VisualPot = {
  id: string;
  label: string;
  amount: number;
  eligible: string[];
};
export type VisualPlayer = {
  id: string;
  name: string;
  stack: number;
  bet: number;
  cards: VisualCard[];
  folded: boolean;
  revealed: boolean;
  action: string;
  hand: VisualHand | null;
  role?: string;
  connected?: boolean;
};
export type SeatPosition = { left: number; top?: number; bottom?: number };
export type TablePresentation = {
  players: VisualPlayer[];
  board: { card: VisualCard; revealed: boolean }[];
  pot: number;
  pots: VisualPot[];
  winner: string | null;
  awarded: number;
  winners?: string[];
  awards?: Record<string, number>;
  heroId?: string;
  dealerId?: string;
  positions?: Record<string, SeatPosition>;
  handId?: string;
  handLabel?: string;
  phase?: string;
};
export const visualKey = (c: VisualCard) => `${c.rank}${c.suit}`;
