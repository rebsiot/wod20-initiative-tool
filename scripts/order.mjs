/** Pure, Foundry-independent initiative ordering logic. */
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
  if (!preceding) return { updates: [{ _id: moved.id, initiative: following.initiative + 1 }], reason: null };
  if (!following) return { updates: [{ _id: moved.id, initiative: preceding.initiative - 1 }], reason: null };
  if (preceding.initiative > following.initiative) {
    const midpoint = (preceding.initiative + following.initiative) / 2;
    if (midpoint > following.initiative && midpoint < preceding.initiative) {
      return { updates: [{ _id: moved.id, initiative: midpoint }], reason: null };
    }
    return { updates: [], reason: "Adjacent initiative scores are too close to reorder safely." };
  }
  if (preceding.initiative !== following.initiative) {
    return { updates: [], reason: "Unexpected initiative ordering; refresh the tracker and retry." };
  }

  // A tie has no numeric gap. Separate just that contiguous tie block by a small
  // fractional amount; unlike a full reindex, all other original scores survive.
  const tieScore = preceding.initiative;
  let first = newIndex - 1;
  let last = newIndex + 1;
  while (first > 0 && reordered[first - 1].initiative === tieScore) first--;
  while (last + 1 < reordered.length && reordered[last + 1].initiative === tieScore) last++;
  const count = last - first + 1;
  const upper = reordered[first - 1]?.initiative;
  let step = 0.001;
  if (upper !== undefined) step = Math.min(step, (upper - tieScore) / (count + 1));
  if (!(step > Number.EPSILON * Math.max(1, Math.abs(tieScore)) * count)) {
    return { updates: [], reason: "No safe numeric space remains among tied scores." };
  }
  const updates = reordered.slice(first, last + 1).map((combatant, i) => ({
    _id: combatant.id,
    initiative: tieScore + (count - 1 - i) * step
  })).filter(({ _id, initiative }) => reordered.find(c => c.id === _id)?.initiative !== initiative);
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
