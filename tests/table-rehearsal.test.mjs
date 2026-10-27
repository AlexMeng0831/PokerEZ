import test from "node:test";
import assert from "node:assert/strict";
import { initialGame, gameReducer, rehearsalOpening, rehearsalRound } from "../src/lib/animation/mock-game.ts";
function apply(state, events) {
  assert.ok(events.length);
  for (const event of events) {
    state = gameReducer(state, event);
    assert.equal(state.pot + state.players.reduce((n, p) => n + p.stack + p.bet, 0), 480);
    assert.ok(state.players.every((p) => p.stack >= 0 && p.bet >= 0));
  }
  return state;
}
test("all 16 check/call and maximum-bet paths conserve chips through payout", () => {
  for (let mask = 0; mask < 16; mask++) {
    let state = apply(initialGame(), rehearsalOpening());
    for (let street = 0; street < 4; street++) {
      state = apply(state, rehearsalRound(state, street, mask & (1 << street) ? "bet" : "check-call", street === 0 ? 24 : 16));
      assert.equal(state.board.length, [3, 4, 5, 5][street]);
    }
    assert.equal(state.winner, "you");
    assert.equal(state.pot, 0);
    assert.ok(state.awarded > 0);
    assert.deepEqual(rehearsalRound(state, 3, "bet", 16), []);
  }
});
test("fold at every street preserves private hand and highlights, with no award to folded player", () => {
  for (let foldAt = 0; foldAt < 4; foldAt++) {
    let state = apply(initialGame(), rehearsalOpening());
    for (let street = 0; street < foldAt; street++) state = apply(state, rehearsalRound(state, street, "check-call"));
    const before = state.players[0];
    state = apply(state, rehearsalRound(state, foldAt, "fold"));
    assert.equal(state.winner, "alex");
    assert.equal(state.players[0].stack, before.stack);
    assert.equal(state.players[0].folded, true);
    assert.equal(state.players[0].revealed, true);
    assert.deepEqual(state.players[0].cards, before.cards);
    assert.equal(state.board.length, 5);
    assert.equal(state.players[0].hand.label, "Three of a kind");
  }
});
test("invalid or unsupported demo bet sizes cannot change the presentation state", () => {
  const state = apply(initialGame(), rehearsalOpening());
  for (const amount of [NaN, Infinity, -8, 0, 4, 17, 25, 1000]) assert.deepEqual(rehearsalRound(state, 0, "bet", amount), []);
  assert.deepEqual(rehearsalRound(initialGame(), 0, "bet", 16), []);
});
