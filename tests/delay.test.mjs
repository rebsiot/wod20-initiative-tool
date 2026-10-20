import assert from "node:assert/strict";
import test from "node:test";
import { isDelayed, withDelayed, withoutDelayed, skipDelayedTurn, targetAfterMove } from "../scripts/delay.mjs";
const turns = ["A", "B", "C", "D"].map(id => ({ id }));

function combat(turn = 0, round = 1) { return { started: true, round, turn, turns }; }

test("Delay lasts only this round; rejoin removes only one participant", () => {
  const waiting = withDelayed({ X: 1, B: 2 }, "A", 2);
  assert.deepEqual(waiting, { B: 2, A: 2 });
  assert.equal(isDelayed(waiting, "A", 2), true);
  assert.equal(isDelayed(waiting, "A", 3), false);
  assert.equal(isDelayed(withoutDelayed(waiting, "A"), "A", 2), false);
  assert.equal(isDelayed(waiting, "C", 2), false);
});

test("Native nextTurn skips a single delaying participant", () => {
  const c = combat(0), changed = { turn: 1 };
  assert.equal(skipDelayedTurn(c, changed, { B: 1 }), true);
  assert.deepEqual(changed, { turn: 2 });
});

test("Native nextTurn skips a chain of delayed participants", () => {
  const c = combat(0), changed = { turn: 1 };
  skipDelayedTurn(c, changed, { B: 1, C: 1 });
  assert.deepEqual(changed, { turn: 3 });
});

test("Exhausting undelayed combatants advances the native round once", () => {
  const c = combat(1), changed = { turn: 2 };
  skipDelayedTurn(c, changed, { C: 1, D: 1 });
  assert.deepEqual(changed, { turn: 0, round: 2 });
});

test("Delay expires when round advances, without lingering skip behavior", () => {
  const c = combat(3, 1), changed = { round: 2, turn: 0 };
  assert.equal(skipDelayedTurn(c, changed, { A: 1 }), false);
  assert.deepEqual(changed, { round: 2, turn: 0 });
});

test("Previous Turn skips delayed entries backwards", () => {
  const c = combat(3), changed = { turn: 2 };
  skipDelayedTurn(c, changed, { C: 1 });
  assert.deepEqual(changed, { turn: 1 });
});

test("Unrelated non-turn updates remain unchanged", () => {
  const changed = { flags: { delayed: { B: 1 } } };
  assert.equal(skipDelayedTurn(combat(), changed, { B: 1 }), false);
  assert.deepEqual(changed, { flags: { delayed: { B: 1 } } });
});

test("Dragging the active participant follows the OLD successor instead", () => {
  assert.deepEqual(targetAfterMove(turns, "A", "A", {}, 1), { nextId: "B", endRound: false });
  assert.deepEqual(targetAfterMove(turns, "B", "B", { C: 1 }, 1), { nextId: "D", endRound: false });
});

test("Dragging an unrelated participant preserves the current active one", () => {
  assert.deepEqual(targetAfterMove(turns, "B", "D", {}, 1), { nextId: "B", endRound: false });
});

test("Dragging the last active participant advances a round", () => {
  assert.deepEqual(targetAfterMove(turns, "D", "D", {}, 1), { nextId: null, endRound: true });
});
