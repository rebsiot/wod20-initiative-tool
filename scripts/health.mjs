/** Read-only health projections for tracker rows. No system or Actor writes. */
const WOD_LEVELS = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"];
const WOD_LABELS = ["Bruised", "Hurt", "Injured", "Wounded", "Mauled", "Crippled", "Incapacitated"];
const finite = x => x === null || x === undefined || x === "" ? null
  : Number.isFinite(Number(x)) ? Number(x) : null;
const bounded = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function canSeeHealth(combatant, user) {
  if (!combatant || !user) return false;
  if (user.isGM) return true;
  if (combatant.hidden) return false;
  const actor = combatant.actor ?? combatant.token?.actor;
  return actor?.testUserPermission?.(user, globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3) === true;
}

function asModel(value, max, label = "Health", details = label) {
  const n = finite(value), m = finite(max);
  if (n === null || m === null || m <= 0) return null;
  return { value: bounded(n, 0, m), max: m, label, details };
}

/** WoD20 Mage/V20 physical health: count native boxes, not the stale cached max. */
export function woundHealth(actor) {
  if (!actor?.system?.health?.damage) return null;
  const system = actor.system, health = system.health, d = health.damage;
  const identity = [actor.type, system.settings?.splat, system.settings?.game].filter(x => typeof x === "string").join(" ");
  if (/wraith|changeling/i.test(identity) || system.settings?.usechimerical === true) return null;
  const wounds = [finite(d.bashing), finite(d.lethal), finite(d.aggravated)];
  if (wounds.some(x => x === null)) return null;
  const boxes = WOD_LEVELS.map(x => finite(health[x]?.total));
  if (boxes.some(x => x === null || x < 0)) return null;
  const max = boxes.reduce((a,b) => a+b, 0);
  if (max <= 0) return null;
  const total = wounds.reduce((a,b) => a+Math.max(0,b), 0);
  let label = "Uninjured";
  if (total > 0) {
    let pending = total;
    for (let i = 0; i < boxes.length; i++) {
      pending -= boxes[i];
      if (pending <= 0 || i === boxes.length - 1) {
        label = WOD_LABELS[i];
        break;
      }
    }
  }
  return asModel(max - total, max, label,
    `${label}: ${Math.max(0,wounds[0])} bashing, ${Math.max(0,wounds[1])} lethal, ${Math.max(0,wounds[2])} aggravated`);
}

/** Generic fallback to common native system health resources, no hard dependency. */
export function getHealth(actor) {
  if (!actor?.system) return null;
  const wod = woundHealth(actor);
  if (wod) return wod;
  const sys = actor.system;
  for (const x of [sys.attributes?.hp, sys.resources?.health, sys.health, sys.hp, sys.attributes?.health]) {
    const result = asModel(x?.value, x?.max);
    if (result) return result;
  }
  return null;
}

/** Returns only the data a particular user is permitted to see. */
export function healthFor(combatant, user) {
  if (!canSeeHealth(combatant, user)) return null;
  return getHealth(combatant.actor ?? combatant.token?.actor);
}
