import { parseArgs } from "node:util";
import {
  applyAction,
  createDeck,
  createHistory,
  createTable,
  formatCard,
  getLegalActions,
  getPublicEvents,
  replayHistory,
  startHand,
} from "../dist/index.js";

const { values } = parseArgs({
  options: {
    players: { type: "string" },
    hands: { type: "string", default: "1" },
    seed: { type: "string", default: "42" },
    policy: { type: "string", default: "calls" },
  },
});
function integer(value, min, max, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new RangeError(`${label} must be an integer in ${min}..${max}`);
  return n;
}
const seed = integer(values.seed, 0, 4294967295, "seed");
const handCount = integer(values.hands, 1, 100, "hands");
if (!["calls", "all-in"].includes(values.policy))
  throw new Error("policy must be calls or all-in");
function must(result) {
  if (!result.ok)
    throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
function log(events) {
  for (const { data: d } of getPublicEvents(events)) {
    switch (d.type) {
      case "HAND_STARTED":
        console.log(
          `\nHand: button ${d.buttonSeat}, SB ${d.smallBlindSeat}, BB ${d.bigBlindSeat}`,
        );
        break;
      case "BLIND_POSTED":
        console.log(`  ${d.playerId} posts ${d.blind} ${d.amount}`);
        break;
      case "STREET_STARTED":
        console.log(`  [${d.phase}]`);
        break;
      case "BOARD_DEALT":
        console.log(`  Board: ${d.cards.map(formatCard).join(" ")}`);
        break;
      case "ACTION":
        console.log(
          `  ${d.playerId} ${d.action}${d.paid ? ` +${d.paid} (street total ${d.streetTotal})` : ""}${d.fullRaise ? " [full raise]" : ""}`,
        );
        break;
      case "UNCALLED_RETURNED":
        console.log(`  Refund: ${d.playerId} +${d.amount}`);
        break;
      case "SHOWDOWN":
        for (const h of d.hands)
          console.log(
            `  ${h.playerId}: ${h.cards.map(formatCard).join(" ")} -> ${h.value.category} [${h.value.kickers.join(", ")}]`,
          );
        break;
      case "POT_AWARDED":
        console.log(
          `  ${d.pot.id}: ${d.pot.amount}; eligible ${d.pot.eligible.join(", ")}; ${d.pot.shares.map((s) => `${s.playerId} +${s.amount}`).join(", ")}`,
        );
        break;
    }
  }
}
function policy(state, allIn) {
  const playerId = state.actorId;
  const legal = getLegalActions(state, playerId);
  if (allIn && legal.allIn) return { playerId, type: "ALL_IN" };
  // Small bets on each street make the normal heads-up demo visible in the log.
  if (
    !allIn &&
    legal.bet &&
    state.players.find((p) => p.id === playerId).reopenAt === null
  )
    return { playerId, type: "BET", to: legal.bet.minTo };
  if (!allIn && legal.raiseTo && state.actionHistory.length === 0)
    return { playerId, type: "RAISE_TO", to: legal.raiseTo.minTo };
  return { playerId, type: legal.check ? "CHECK" : "CALL" };
}
function run(initial, allIn, deck) {
  let result = startHand(initial, deck);
  let state = must(result);
  log(result.events);
  let steps = 0;
  while (state.phase !== "FINISHED") {
    if (++steps > 10000) throw new Error("Simulator failed to terminate");
    result = applyAction(state, policy(state, allIn));
    state = must(result);
    log(result.events);
  }
  const total = state.players.reduce((sum, p) => sum + p.stack, 0);
  if (total !== initial.players.reduce((sum, p) => sum + p.stack, 0))
    throw new Error("Chip conservation failed");
  const history = createHistory(initial, state);
  if (JSON.stringify(replayHistory(history).state) !== JSON.stringify(state))
    throw new Error("Replay mismatch");
  console.log(
    `  Final stacks: ${state.players.map((p) => `${p.id}=${p.stack}`).join(" ")} (total ${total}; replay verified)`,
  );
  return state;
}
function table(stacks, label) {
  return createTable(
    stacks.map((stack, seat) => ({ id: `p${seat}`, seat, stack })),
    { shuffleSeed: seed },
    label,
  );
}
if (values.players) {
  const n = integer(values.players, 2, 6, "players");
  let current = table(Array(n).fill(1000), `${n}-player`);
  for (let i = 0; i < handCount; i++) {
    if (current.players.filter((p) => p.stack > 0).length < 2) {
      console.log("Fewer than two funded players remain.");
      break;
    }
    current = run(current, values.policy === "all-in");
  }
} else {
  console.log("=== Heads-up: four streets ===");
  run(table([1000, 1000], "heads-up"), false);
  console.log("\n=== Six players: multiple side pots ===");
  run(table([60, 90, 120, 180, 240, 300], "six-player"), true);
  console.log("\n=== Three players: different main/side winners ===");
  const tokens = "As Ks Qs Ah Kh Qh 4c 2c 3d 7h 5c 8s 6c 9c".split(" ");
  const first = tokens.map((s) => ({
    rank: "23456789TJQKA".indexOf(s[0]) + 2,
    suit: s[1],
  }));
  const deck = [
    ...first,
    ...createDeck().filter(
      (c) => !first.some((p) => p.rank === c.rank && p.suit === c.suit),
    ),
  ];
  run(table([200, 50, 100], "split-winners"), true, deck);
}
