import assert from "node:assert/strict";
import test from "node:test";
import { installTopTurnControls } from "../scripts/top-turn-controls.mjs";

function setup({ isGM = true, started = true, round = 2, turn = 1 } = {}) {
  let previousCalls = 0;
  let nextCalls = 0;
  const notices = [];
  const events = new Map();
  const make = tag => ({
    tag,
    children: [],
    parentElement: null,
    disabled: false,
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    addEventListener(k, fn) { events.set(this, { ...events.get(this), [k]: fn }); },
    append(...items) { for (const x of items) { x.parentElement = this; this.children.push(x); } },
    insertBefore(item, target) {
      item.parentElement = this;
      this.children.splice(this.children.indexOf(target), 0, item);
    },
    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter(x => x !== this);
      this.parentElement = null;
    }
  });
  const holder = make("main");
  const list = make("ol");
  list.id = "combat-tracker";
  const footer = make("footer");
  holder.append(list, footer);
  const root = {
    ownerDocument: { createElement: make },
    querySelector(selector) {
      if (selector.startsWith(".wod20-initiative-tool-turn-navigation")) {
        return holder.children.find(x => x.className === "wod20-initiative-tool-turn-navigation") ?? null;
      }
      if (selector.includes("#combat-tracker")) return list;
      return null;
    }
  };
  const combat = {
    id: "combat-A", started, round, turn, turns: [{ id: "A" }, { id: "B" }],
    async previousTurn() { previousCalls++; this.turn--; },
    async nextTurn() { nextCalls++; this.turn++; }
  };
  let viewed = combat;
  const draw = () => installTopTurnControls({
    root, combat, isGM, getViewedCombat: () => viewed,
    notify: (...args) => notices.push(args)
  });
  async function click(element) {
    let prevented = false;
    let stopped = false;
    await events.get(element).click({
      preventDefault() { prevented = true; }, stopPropagation() { stopped = true; }
    });
    assert.equal(prevented, true);
    assert.equal(stopped, true);
  }
  return {
    draw, click, holder, list, footer, combat, notices,
    get nav() { return holder.children.find(x => x.className === "wod20-initiative-tool-turn-navigation"); },
    get previousCalls() { return previousCalls; },
    get nextCalls() { return nextCalls; },
    switchViewed(next) { viewed = next; }
  };
}

test("GM gets duplicate turn buttons ABOVE the list, with native footer untouched", () => {
  const x = setup();
  x.draw();
  assert.deepEqual(x.holder.children.map(node => node.tag), ["div", "ol", "footer"]);
  assert.equal(x.footer.parentElement, x.holder);
  assert.equal(x.nav.children.length, 2);
  assert.equal(x.nav.children[0].attributes["aria-label"], "Previous Turn");
  assert.equal(x.nav.children[1].attributes["aria-label"], "Next Turn");
  assert.equal(x.nav.attributes["aria-label"], "GM combat turn navigation");
});

test("Previous and Next use native Combat methods, not raw round/turn writes", async () => {
  const x = setup();
  x.draw();
  await x.click(x.nav.children[0]);
  await x.click(x.nav.children[1]);
  assert.equal(x.previousCalls, 1);
  assert.equal(x.nextCalls, 1);
  assert.equal(x.combat.turn, 1);
});

test("GM previous is disabled at first turn of first round", () => {
  const x = setup({ round: 1, turn: 0 });
  x.draw();
  assert.equal(x.nav.children[0].disabled, true);
  assert.equal(x.nav.children[1].disabled, false);
});

test("Players and encounters which have not started don't get top controls", () => {
  const x = setup({ isGM: false });
  x.draw();
  assert.equal(x.nav, undefined);
  const y = setup({ started: false });
  y.draw();
  assert.equal(y.nav, undefined);
});

test("Controls do not act on a different encounter after tracker selection changes", async () => {
  const x = setup();
  x.draw();
  x.switchViewed({ id: "combat-B", started: true });
  await x.click(x.nav.children[1]);
  assert.equal(x.nextCalls, 0);
});

test("Re-render replaces rather than duplicates top controls", () => {
  const x = setup();
  x.draw();
  const first = x.nav;
  x.draw();
  assert.notEqual(first, x.nav);
  assert.equal(x.holder.children.filter(n => n.className === "wod20-initiative-tool-turn-navigation").length, 1);
  assert.equal(x.holder.children.at(-1), x.footer);
});

test("Rapid clicks cannot double-advance while native advance is pending", async () => {
  const x = setup();
  let settle;
  x.combat.nextTurn = () => { x.combat.calls = (x.combat.calls ?? 0) + 1; return new Promise(r => { settle = r; }); };
  x.draw();
  const next = x.nav.children[1];
  const first = x.click(next);
  assert.equal(next.disabled, true);
  await x.click(next);
  assert.equal(x.combat.calls, 1);
  settle();
  await first;
  assert.equal(next.disabled, false);
});

test("Failed native turn change is reported and controls are enabled for retry", async () => {
  const x = setup();
  x.combat.nextTurn = async () => { throw new Error("not permitted"); };
  x.draw();
  const original = console.error;
  console.error = () => {};
  try {
    await x.click(x.nav.children[1]);
    assert.equal(x.notices.length, 1);
    assert.match(x.notices[0][0], /Could not change combat turn/);
    assert.equal(x.notices[0][1], "error");
    assert.equal(x.nav.children[1].disabled, false);
  } finally { console.error = original; }
});
