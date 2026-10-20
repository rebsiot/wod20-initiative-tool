/** Small, pure helper for the per-round Delay / Rejoin initiative policy. */

export function isDelayed(delayed, id, round) {
  return id != null && Number(delayed?.[id]) === Number(round);
}

/** Entries from earlier rounds expire without changing the original initiative score. */
export function withDelayed(delayed, id, round) {
  const next = Object.fromEntries(Object.entries(delayed ?? {}).filter(([, r]) => Number(r) === Number(round)));
  next[id] = Number(round);
  return next;
}

export function withoutDelayed(delayed, id) {
  const next = { ...(delayed ?? {}) };
  delete next[id];
  return next;
}

/**
 * Adjust one native Combat update BEFORE it commits to avoid granting a turn to
 * a combatant who is still delaying. The entire update is still one native
 * document update, preserving the usual round/turn hooks.
 *
 * Delay expires at a round boundary: the new round uses the normal initiative
 * order. Do not make a second update from an updateCombat listener.
 */
export function skipDelayedTurn(combat, changed, delayed) {
  if (!combat?.started || !Object.hasOwn(changed, "turn")) return false;
  const fromRound = Number(combat.round);
  const toRound = Object.hasOwn(changed, "round") ? Number(changed.round) : fromRound;
  if (!Number.isInteger(fromRound) || !Number.isInteger(toRound) || toRound !== fromRound) return false;
  const turns = combat.turns ?? [];
  const index = Number(changed.turn);
  if (!Number.isInteger(index) || index < 0 || index >= turns.length) return false;
  if (!isDelayed(delayed, turns[index]?.id, fromRound)) return false;

  const priorTurn = Number(combat.turn ?? -1);
  const forward = index >= priorTurn;
  if (forward) {
    for (let i = index + 1; i < turns.length; i++) {
      if (!isDelayed(delayed, turns[i].id, fromRound)) {
        changed.turn = i;
        return true;
      }
    }
    // No eligible combatants remain this round; delayed actions are forfeited.
    changed.round = fromRound + 1;
    changed.turn = 0;
    return true;
  }
  // GM Previous Turn may go backwards past a waiting participant.
  for (let i = index - 1; i >= 0; i--) {
    if (!isDelayed(delayed, turns[i].id, fromRound)) {
      changed.turn = i;
      return true;
    }
  }
  changed.turn = priorTurn; // No valid earlier turn; do not pick the delaying actor.
  return true;
}

/**
 * Reordering the current combatant ends their action and proceeds to the next
 * previously scheduled, non-delayed participant, NOT the combatant just dragged.
 */
export function targetAfterMove(turns, currentId, movedId, delayed, round) {
  if (!currentId) return { nextId: null, endRound: false };
  if (currentId !== movedId) return { nextId: currentId, endRound: false };
  const index = turns.findIndex(c => c.id === currentId);
  if (index < 0) return { nextId: null, endRound: false };
  const next = turns.slice(index + 1).find(c => !isDelayed(delayed, c.id, round));
  return next ? { nextId: next.id, endRound: false } : { nextId: null, endRound: true };
}
