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
  assert.deepEqual(x.updates,[{_id:"c",initiative:17}]);
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


test("adjacent scores reorder without fractional initiative or unrelated edits", () => {
  const source = T([["A", 12], ["B", 11], ["C", 10], ["D", 9]]);
  const plan = planMove(source, "D", "B", true);
  assert.equal(plan.reason, null);
  assert.deepEqual(sortedAfter(source, plan.updates), ["A", "D", "B", "C"]);
  assert.deepEqual(plan.updates, [
    { _id: "D", initiative: 11 },
    { _id: "B", initiative: 10 },
    { _id: "C", initiative: 9 }
  ]);
  assert.ok(plan.updates.every(row => Number.isInteger(row.initiative)));
});

test("drag inside tied initiative group uses distinct whole-number ranks", () => {
  const source = T([["A", 12], ["B", 10], ["C", 10], ["D", 10], ["E", 8]]);
  const plan = planMove(source, "E", "C", true);
  assert.equal(plan.reason, null);
  const expected = ["A", "B", "E", "C", "D"];
  assert.deepEqual(sortedAfter(source, plan.updates), expected);
  const scores = new Map(source.map(x => [x.id, x.initiative]));
  for (const { _id, initiative } of plan.updates) scores.set(_id, initiative);
  const ranked = expected.map(id => scores.get(id));
  assert.ok(ranked.every(n => Number.isSafeInteger(n)));
  assert.ok(ranked.every((n, i) => !i || ranked[i - 1] > n));
});

test("drag normalizes legacy fractional scores only on an actual move", () => {
  const source = T([["A", 18], ["B", 17.5], ["C", 17]]);
  assert.deepEqual(planMove(source, "B", "A", false).updates, []);
  const plan = planMove(source, "C", "B", true);
  assert.equal(plan.reason, null);
  assert.deepEqual(sortedAfter(source, plan.updates), ["A", "C", "B"]);
  const result = new Map(source.map(x => [x.id, x.initiative]));
  for (const row of plan.updates) result.set(row._id, row.initiative);
  assert.ok([...result.values()].every(Number.isSafeInteger));
});

test("single moved combatant uses whole numbers at ends and in negative ranges", () => {
  const source = T([["A", 1], ["B", 0], ["C", -1]]);
  assert.deepEqual(planMove(source, "C", "A", true).updates, [{ _id: "C", initiative: 2 }]);
  assert.deepEqual(planMove(source, "A", "C", false).updates, [{ _id: "A", initiative: -2 }]);
});

test("extreme initiative magnitudes never emit unsafe numbers", () => {
  const source = T([["A", Number.MAX_SAFE_INTEGER], ["B", Number.MAX_SAFE_INTEGER]]);
  const plan = planMove(source, "B", "A", true);
  assert.equal(plan.reason, null);
  assert.deepEqual(sortedAfter(source, plan.updates), ["B", "A"]);
  assert.ok(plan.updates.every(row => Number.isSafeInteger(row.initiative)));
});

test("200 seeded GM drag cases retain exact requested order with integer scores", () => {
  let seed = 12877;
  const rnd = n => { seed = (1664525 * seed + 1013904223) >>> 0; return seed % n; };
  for (let attempt = 0; attempt < 200; attempt++) {
    const size = 2 + rnd(10);
    const source = Array.from({ length: size }, (_, i) => ({
      id: `id${String(i).padStart(2, '0')}`,
      initiative: rnd(25) - 2 + (rnd(4) === 0 ? 0.5 : 0)
    })).sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id));
    const fromIndex = rnd(size);
    const targetIndex = (fromIndex + 1 + rnd(size - 1)) % size;
    const before = rnd(2) === 0;
    const moved = source[fromIndex];
    const target = source[targetIndex];
    const expected = source.filter(c => c.id !== moved.id);
    const insertAt = expected.findIndex(c => c.id === target.id) + (before ? 0 : 1);
    const plan = planMove(source, moved.id, target.id, before);
    assert.equal(plan.reason, null, `unexpected issue in case ${attempt}`);
    if (insertAt === fromIndex) {
      assert.equal(plan.updates.length, 0);
      continue;
    }
    expected.splice(insertAt, 0, moved);
    const scores = new Map(source.map(c => [c.id, c.initiative]));
    for (const row of plan.updates) scores.set(row._id, row.initiative);
    assert.ok([...scores.values()].every(Number.isSafeInteger), `fractional result in case ${attempt}`);
    const indexOf = new Map(source.map((c, i) => [c.id, i]));
    const actual = source.slice().sort((a, b) => scores.get(b.id) - scores.get(a.id) || indexOf.get(a.id) - indexOf.get(b.id));
    assert.deepEqual(actual.map(c => c.id), expected.map(c => c.id), `incorrect order in case ${attempt}`);
  }
});
