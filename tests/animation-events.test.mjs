import test from "node:test";
import assert from "node:assert/strict";
import {
  gameReducer,
  initialGame,
  MOCK_CHAPTERS,
} from "../src/lib/animation/mock-game.ts";
const total = (state) =>
  state.pot + state.players.reduce((sum, p) => sum + p.stack + p.bet, 0);
test("the entire fixture conserves 480 chips and never produces a negative stack", () => {
  let state = initialGame();
  for (const chapter of MOCK_CHAPTERS)
    for (const event of chapter.events) {
      state = gameReducer(state, event);
      assert.equal(total(state), 480, event.type);
      assert.ok(state.players.every((p) => p.stack >= 0 && p.bet >= 0));
      if (event.type === "side-pots") {
        assert.equal(
          state.pots.reduce((sum, p) => sum + p.amount, 0),
          state.pot,
        );
        for (const pot of state.pots)
          assert.ok(
            pot.eligible.every(
              (id) => !state.players.find((p) => p.id === id).folded,
            ),
          );
      }
    }
  assert.equal(state.awarded, 280);
  assert.equal(state.pot, 0);
  assert.equal(state.players.find((p) => p.id === "you").stack, 380);
});
test("deal and board sequence use unique cards; folded demo hand stays visible and keeps its best-hand hint", () => {
  let state = initialGame();
  for (const chapter of MOCK_CHAPTERS) {
    for (const event of chapter.events) state = gameReducer(state, event);
    if (chapter.label === "Deal")
      assert.ok(state.players.every((p) => p.cards.length === 2));
    if (chapter.label === "Showdown") {
      assert.equal(state.players.find((p) => p.id === "alex").revealed, true);
      assert.equal(state.players.find((p) => p.id === "sam").revealed, true);
      assert.equal(state.winner, "you");
    }
  }
  assert.equal(state.board.length, 5);
  assert.ok(state.board.every((c) => c.revealed));
  const cards = [
    ...state.players.flatMap((p) => p.cards),
    ...state.board.map((c) => c.card),
  ];
  assert.equal(new Set(cards.map((c) => c.rank + c.suit)).size, 11);
});
test("reset is independent of playback boundary and reducer leaves earlier state intact", () => {
  const original = initialGame();
  let state = original;
  for (const chapter of MOCK_CHAPTERS)
    for (const event of chapter.events) {
      state = gameReducer(state, event);
      assert.deepEqual(gameReducer(state, { type: "reset" }), initialGame());
    }
  assert.deepEqual(original, initialGame());
});

test("hand highlights describe cards available at each stage, including the two pocket queens", () => {
  let state = initialGame();
  for (const chapter of MOCK_CHAPTERS) {
    for (const event of chapter.events) {
      state = gameReducer(state, event);
      for (const player of state.players) {
        if (!player.hand) continue;
        const available = new Set(
          [
            ...player.cards,
            ...state.board.filter((b) => b.revealed).map((b) => b.card),
          ].map((c) => c.rank + c.suit),
        );
        assert.ok(
          player.hand.madeCards.every((key) => available.has(key)),
          player.id + ": unavailable highlighted card",
        );
      }
    }
    if (chapter.label === "Deal") {
      const hand = state.players.find((p) => p.id === "you").hand;
      assert.equal(hand.label, "Pair");
      assert.deepEqual(hand.madeCards, ["Q♥", "Q♠"]);
    }
    if (chapter.label === "Flop") {
      const hand = state.players.find((p) => p.id === "you").hand;
      assert.equal(hand.label, "Three of a kind");
      assert.deepEqual(hand.madeCards, ["Q♥", "Q♠", "Q♦"]);
    }
    if (chapter.label === "Fold") {
      const alex = state.players.find((p) => p.id === "alex");
      assert.equal(alex.folded, true);
      assert.equal(alex.revealed, true);
      assert.equal(alex.cards.length, 2);
      assert.equal(alex.hand.detail, "Aces");
    }
  }
});
test("fold visibility remains producer-controlled outside the open mock fixture", () => {
  const state = gameReducer(initialGame(), { type: "fold", seat: "sam" });
  assert.equal(state.players.find((p) => p.id === "sam").revealed, false);
});
