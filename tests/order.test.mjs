import assert from "node:assert/strict";
import test from "node:test";
import { planMove, blocksLockedInitiativeChange } from "../scripts/order.mjs";
const T = (xs) => xs.map(([id, initiative]) => ({ id, initiative }));
function sortedAfter(source, updates) {
  const scores = new Map(source.map(c => [c.id, c.initiative]));
  for (const row of updates) scores.set(row._id, row.initiative);
  return source.slice().sort((a, b) => scores.get(b.id) - scores.get(a.id) || a.id.localeCompare(b.id)).map(c => c.id);
}
test("GM move: midpoint only modifies moved score", () => {
  const a = T([["a",20],["b",15],["c",10]]);
  const x = planMove(a, "c", "b", true);
  assert.deepEqual(x.updates,[{_id:"c",initiative:17.5}]);
  assert.deepEqual(sortedAfter(a,x.updates),["a","c","b"]);
});
test("GM move: place before top", () => {
  const a = T([["a",20],["b",15],["c",10]]);
  const x = planMove(a,"c","a",true);
  assert.deepEqual(sortedAfter(a,x.updates),["c","a","b"]);
});
test("GM move: place after bottom", () => {
  const a = T([["a",20],["b",15],["c",10]]);
  const x = planMove(a,"a","c",false);
  assert.deepEqual(sortedAfter(a,x.updates),["b","c","a"]);
});
test("GM move: ties separate only the local group", () => {
  const a = T([["a",21],["b",20],["c",20],["d",20],["e",15]]);
  const x = planMove(a,"e","c",true);
  assert.deepEqual(sortedAfter(a,x.updates),["a","b","e","c","d"]);
  assert.ok(x.updates.every(u => !["a"].includes(u._id)));
  assert.equal(x.updates.some(u=>u._id==="e"),true);
});
test("no-op and unrolled: no updates", () => {
  const a = T([["a",20],["b",15],["c",null]]);
  assert.equal(planMove(a,"b","a",false).updates.length,0);
  assert.match(planMove(a,"c","a",true).reason,/Roll/);
});
test("locked score guard: blocks overwrite and clearing by GM or players", () => {
  const c = {initiative:18};
  assert.equal(blocksLockedInitiativeChange(c,{initiative:4},{},true,false),true);
  assert.equal(blocksLockedInitiativeChange(c,{initiative:null},{},true,true),true);
  assert.equal(blocksLockedInitiativeChange(c,{initiative:4},{wod20InitiativeToolBypass:true},true,true),false);
  assert.equal(blocksLockedInitiativeChange(c,{initiative:4},{wod20InitiativeToolBypass:true},true,false),true);
  assert.equal(blocksLockedInitiativeChange(c,{hidden:true},{},true,false),false);
  assert.equal(blocksLockedInitiativeChange(c,{initiative:4},{},false,false),false);
});
test("locked score guard: permits a first roll, not reset", () => {
  assert.equal(blocksLockedInitiativeChange({initiative:null},{initiative:17},{},true,false),false);
  assert.equal(blocksLockedInitiativeChange({initiative:null},{initiative:null},{},true,false),true);
});
