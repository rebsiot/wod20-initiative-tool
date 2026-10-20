import assert from "node:assert/strict";
import test from "node:test";

const hooks = new Map();
globalThis.Hooks = {
  once(name, fn) { hooks.set(name, [...(hooks.get(name) ?? []), fn]); },
  on(name, fn) { hooks.set(name, [...(hooks.get(name) ?? []), fn]); }
};
let warnings = 0;
globalThis.ui = { notifications: { warn() { warnings++; }, info() {}, error() {} } };
globalThis.game = { user: { isGM: false }, settings: { register() {} } };
globalThis.foundry = { applications: { sidebar: { tabs: { CombatTracker: class CombatTracker {} } } } };
await import("../scripts/main.mjs");
for (const callback of hooks.get("init")) callback();
const call = (name, ...args) => hooks.get(name)?.at(0)(...args);
const combat = { getFlag(_scope, flag) { return flag === "locked"; } };

test("preUpdateCombatant cancels a normal reroll", () => {
  assert.equal(call("preUpdateCombatant", { initiative: 15, parent: combat }, { initiative: 22 }, {}), false);
  assert.ok(warnings >= 1);
});
test("preUpdateCombatant allows unrelated status changes", () => {
  assert.equal(call("preUpdateCombatant", { initiative: 15, parent: combat }, { hidden: true }, {}), undefined);
});
test("preUpdateCombatant allows a late combatant first initiative", () => {
  assert.equal(call("preUpdateCombatant", { initiative: null, parent: combat }, { initiative: 12 }, {}), undefined);
});
test("preUpdateCombatant permits GM's explicit module drag bypass but not player's", () => {
  const params = [{ initiative: 18, parent: combat }, { initiative: 20 }, { wod20InitiativeToolBypass: true }];
  assert.equal(call("preUpdateCombatant", ...params), false);
  game.user.isGM = true;
  assert.equal(call("preUpdateCombatant", ...params), undefined);
  game.user.isGM = false;
});
test("preUpdateCombat rejects parent array initiative replacements", () => {
  assert.equal(call("preUpdateCombat", combat, { combatants: [{_id:"X", initiative:0}] }, {}), false);
  assert.equal(call("preUpdateCombat", combat, { round: 2 }, {}), undefined);
});
