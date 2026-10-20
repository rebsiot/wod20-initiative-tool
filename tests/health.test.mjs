import assert from "node:assert/strict";
import test from "node:test";
import { canSeeHealth, woundHealth, getHealth, healthFor } from "../scripts/health.mjs";
const levels = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"];
function mage(bashing = 0, lethal = 0, aggravated = 0) {
  return { type: "mage", system: { health: {
    damage: { bashing, lethal, aggravated },
    ...Object.fromEntries(levels.map(level => [level, { total: 1 }]))
  } }, testUserPermission(user) { return user.id === "owner"; } };
}

test("WoD20 wounds read seven native boxes and remain read-only", () => {
  const actor = mage(1, 1, 1), before = JSON.stringify(actor);
  assert.deepEqual(woundHealth(actor), {
    value: 4, max: 7, label: "Injured", details: "Injured: 1 bashing, 1 lethal, 1 aggravated"
  });
  assert.equal(JSON.stringify(actor), before);
});

test("WoD20 expanded health levels use the real box count", () => {
  const actor = mage(1, 1, 0);
  actor.system.health.hurt.total = 3;
  assert.equal(getHealth(actor).max, 9);
  assert.equal(getHealth(actor).value, 7);
  assert.equal(getHealth(actor).label, "Hurt");
});

test("No damage and full damage show correct remaining health", () => {
  assert.equal(getHealth(mage()).value, 7);
  const h = getHealth(mage(8, 0, 0));
  assert.equal(h.value, 0);
  assert.equal(h.label, "Incapacitated");
});

test("WoD20 unsupported health track is not mislabeled physical HP", () => {
  const actor = mage(1, 0, 0); actor.type = "wraith";
  assert.equal(getHealth(actor), null);
});

test("Generic systems' common HP resources are supported without dependency", () => {
  const actor = { system: { attributes: { hp: { value: 12, max: 20 } } } };
  assert.equal(getHealth(actor).value, 12);
  assert.equal(getHealth(actor).max, 20);
});

test("Non-GM players only see their own Actor health; hidden combatants stay private", () => {
  const combatant = { actor: mage(2), hidden: false };
  const owner = { id: "owner", isGM: false };
  const outsider = { id: "outsider", isGM: false };
  assert.equal(canSeeHealth(combatant, owner), true);
  assert.equal(healthFor(combatant, owner).value, 5);
  assert.equal(canSeeHealth(combatant, outsider), false);
  assert.equal(healthFor(combatant, outsider), null);
  combatant.hidden = true;
  assert.equal(healthFor(combatant, owner), null);
  assert.equal(healthFor(combatant, {id:"gm",isGM:true}).max, 7);
});

test("Missing, invalid or non-numeric health is not displayed", () => {
  assert.equal(getHealth({ system: { hp: { value: null, max: 0 } } }), null);
  assert.equal(getHealth({ system: {} }), null);
});

test("Empty or null generic HP values are never misreported as zero", () => {
  assert.equal(getHealth({system:{hp:{value:null,max:7}}}), null);
  assert.equal(getHealth({system:{hp:{value:"",max:7}}}), null);
});
