import type { PotResult } from "@pokerez/poker-engine";
import type { TablePresentation } from "./presentation";

/** Animate an already-settled Engine payout; never choose eligible players or winners here. */
export function presentPayout(
  state: TablePresentation,
  pot: PotResult,
): TablePresentation {
  const awards = { ...state.awards };
  for (const share of pot.shares)
    awards[share.playerId] = (awards[share.playerId] ?? 0) + share.amount;
  return {
    ...state,
    pot: Math.max(0, state.pot - pot.amount),
    pots: state.pots.filter((p) => p.id !== pot.id),
    awards,
    winners: Object.keys(awards),
    winner: Object.keys(awards)[0] ?? null,
    players: state.players.map((p) => ({
      ...p,
      stack:
        p.stack + (pot.shares.find((s) => s.playerId === p.id)?.amount ?? 0),
    })),
  };
}
