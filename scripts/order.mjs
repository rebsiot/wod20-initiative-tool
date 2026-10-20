/** Pure, Foundry-independent initiative ordering logic. */

/**
 * Produce distinct, descending whole-number rank slots close to the
 * original scores. Prefer preserving as many current values as possible;
 * with ties, try both directions and choose the smaller change set. These
 * slots are assigned in the GM's requested order, not by actor identity.
 */
function integerSlots(entries) {
  const rounded = entries.map(c => Math.round(c.initiative));
  if (rounded.some(n => !Number.isSafeInteger(n))) return null;
  const down = [rounded[0]];
  for (let i = 1; i < rounded.length; i++) {
    down.push(Math.min(rounded[i], down[i - 1] - 1));
  }
  const up = rounded.slice();
  for (let i = up.length - 2; i >= 0; i--) {
    up[i] = Math.max(rounded[i], up[i + 1] + 1);
  }
  const safe = candidate => candidate.every(Number.isSafeInteger)
    && candidate.every((n, i) => i === 0 || candidate[i - 1] > n);
  const candidates = [down, up].filter(safe);
  if (!candidates.length) return null;
  const anyNegativeOriginally = rounded.some(n => n < 0);
  function cost(candidate) {
    const changes = candidate.filter((n, i) => n !== entries[i].initiative).length;
    const absoluteDifference = candidate.reduce((sum, n, i) => sum + Math.abs(n - entries[i].initiative), 0);
    const newNegatives = !anyNegativeOriginally && candidate.some(n => n < 0) ? 1 : 0;
    return [changes, newNegatives, absoluteDifference];
  }
  candidates.sort((a, b) => {
    const x = cost(a), y = cost(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  });
  return candidates[0];
}

export function planMove(turns, movedId, targetId, placeBefore = true) {
  const entries = turns.filter(c => Number.isFinite(c.initiative));
  const fromIndex = entries.findIndex(c => c.id === movedId);
  if (fromIndex < 0) return { updates: [], reason: "Roll this combatant's initiative before dragging it." };
  const remaining = entries.filter(c => c.id !== movedId);
  const targetIndex = remaining.findIndex(c => c.id === targetId);
  if (targetIndex < 0) return { updates: [], reason: "Target does not have an initiative score." };
  const newIndex = targetIndex + (placeBefore ? 0 : 1);
  if (newIndex === fromIndex) return { updates: [], reason: null };

  const reordered = remaining.slice();
  const moved = entries[fromIndex];
  reordered.splice(newIndex, 0, moved);
  const preceding = reordered[newIndex - 1];
  const following = reordered[newIndex + 1];

  // Preserve all other scores when an available whole-number gap allows it.
  // Previously generated fractional scores are normalized on a subsequent
  // actual drag rather than silently migrating a combat when the module loads.
  const allWholeNumbers = entries.every(c => Number.isSafeInteger(c.initiative));
  if (allWholeNumbers) {
    let value = null;
    if (!preceding) value = following.initiative + 1;
    else if (!following) value = preceding.initiative - 1;
    else if (preceding.initiative - following.initiative >= 2) {
      value = Math.floor((preceding.initiative + following.initiative) / 2);
    }
    if (Number.isSafeInteger(value)
      && (!preceding || preceding.initiative > value)
      && (!following || value > following.initiative)) {
      return { updates: [{ _id: moved.id, initiative: value }], reason: null };
    }
  }

  // With adjacent/tied scores there is no integer between the neighbours.
  // Transfer existing integer rank slots instead of introducing decimals.
  // Ties (or decimals left from older builds) are normalized into distinct
  // whole-number ranks only as part of this explicit reorder action.
  const slots = integerSlots(entries);
  if (!slots) return { updates: [], reason: "Initiative values are too large to reorder safely." };
  const updates = reordered.map((c, i) => ({ _id: c.id, initiative: slots[i] }))
    .filter((change, i) => reordered[i].initiative !== change.initiative);
  return { updates, reason: null };
}

export function blocksLockedInitiativeChange(combatant, changed, options, locked, isGM) {
  if (!locked) return false;
  if (!Object.hasOwn(changed, "initiative")) return false;
  if (options?.wod20InitiativeToolBypass === true && isGM) return false;
  // A freshly added or not-yet-rolled combatant gets one initial roll even
  // after the encounter has been locked. Clearing or rerolling is blocked.
  return !(combatant.initiative === null || combatant.initiative === undefined) ||
    !Number.isFinite(changed.initiative);
}
