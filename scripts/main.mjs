import { planMove, blocksLockedInitiativeChange } from "./order.mjs";
import { installTopTurnControls } from "./top-turn-controls.mjs";
import { isDelayed, withDelayed, withoutDelayed, skipDelayedTurn, targetAfterMove } from "./delay.mjs";
import { canSeeHealth, healthFor } from "./health.mjs";

const ID = "wod20-initiative-tool";
const SOCKET = `module.${ID}`;
const DRAG_MIME = `application/x-${ID}`;
const notify = (message, level = "warn") => ui.notifications?.[level]?.(`[WoD20 Initiative Tool] ${message}`);
let lastWarning = 0;
let busy = false;
const inFlight = new Set();

function locked(combat) {
  return combat?.getFlag(ID, "locked") === true;
}

function delayed(combat) {
  return combat?.getFlag(ID, "delayed") ?? {};
}

function currentCombat(app) {
  return app?.viewed ?? game.combats?.viewed ?? game.combat ?? null;
}

function repaint() {
  for (const app of [ui.combat, ui.combat?.popout]) {
    if (app?.rendered) Promise.resolve(app.render({ force: true })).catch(error => console.error(`${ID}: tracker render failed`, error));
  }
}

function statusLabel(isLocked) {
  return isLocked ? "Unlock Initiative" : "Lock Initiative";
}

function refreshVisibleLockButtons(combat) {
  for (const doc of [globalThis.document, ui.combat?.popout?.element?.ownerDocument]) {
    if (!doc?.querySelectorAll) continue;
    for (const button of doc.querySelectorAll(`.${ID}-lock`)) {
      button.replaceChildren(doc.createTextNode(statusLabel(locked(combat))));
      button.dataset.locked = String(locked(combat));
      button.setAttribute("aria-label", locked(combat) ? "Unlock Initiative" : "Lock Initiative");
      button.title = locked(combat) ? "GM: unlock initiative for this encounter" : "GM: save a snapshot and lock initiative";
    }
  }
}

async function toggleLock(combat) {
  if (!game.user.isGM || busy || !combat) return;
  busy = true;
  try {
    if (locked(combat)) {
      await combat.setFlag(ID, "locked", false);
      notify("Initiative unlocked for this encounter.", "info");
    } else {
      const snapshot = {
        capturedAt: new Date().toISOString(),
        round: combat.round,
        rows: combat.combatants.contents.map(c => ({ id: c.id, initiative: c.initiative ?? null }))
      };
      await combat.update({ [`flags.${ID}.snapshot`]: snapshot, [`flags.${ID}.locked`]: true });
      notify("Initiative locked. Existing scores cannot be rerolled or cleared.", "info");
    }
    refreshVisibleLockButtons(combat);
    repaint();
  } catch (error) {
    console.error(`${ID}: toggle failed`, error);
    notify("Unable to change the initiative lock.", "error");
  } finally {
    busy = false;
  }
}

async function confirmRestore() {
  return foundry.applications.api.DialogV2.confirm({
    window: { title: "Restore Initiative Snapshot" },
    content: "<p>Restore the initiative scores saved when this encounter was last locked?</p><p>Only those original combatants will be affected. New combatants and delayed-turn status will remain unchanged.</p>",
    rejectClose: false
  });
}

/** Only called from an operation already guarded by busy; no new dice engine. */
async function applyInitiativeUpdates(combat, updates, { movedId = null, previousTurns = null } = {}) {
  if (!game.user.isGM || !combat || !updates.length) return true;
  const activeId = combat.combatant?.id ?? null;
  const tracking = movedId && previousTurns
    ? targetAfterMove(previousTurns, activeId, movedId, delayed(combat), combat.round)
    : { nextId: activeId, endRound: false };
  const result = await combat.updateEmbeddedDocuments("Combatant", updates, { wod20InitiativeToolBypass: true });
  if (result?.length !== updates.length) {
    notify("Some initiative changes did not apply; check the tracker.", "warn");
    return false;
  }
  if (combat.started && tracking.endRound) {
    // Dragging the CURRENT, last-acting combatant ends their turn; the next
    // round is handed to Foundry rather than following the dragged combatant.
    await combat.nextRound();
  } else if (combat.started && tracking.nextId) {
    const index = combat.turns.findIndex(c => c.id === tracking.nextId);
    if (index >= 0 && combat.turn !== index) await combat.update({ turn: index });
  }
  repaint();
  return true;
}

async function restore(combat) {
  if (!game.user.isGM || busy || !combat) return;
  const snapshot = combat.getFlag(ID, "snapshot");
  if (!Array.isArray(snapshot?.rows) || !snapshot.rows.length) return notify("No saved snapshot for this encounter.");
  if (!(await confirmRestore())) return;
  if (busy) return;
  busy = true;
  try {
    const updates = snapshot.rows
      .filter(row => row.initiative !== null && Number.isFinite(row.initiative) && combat.combatants.get(row.id))
      .map(row => ({ _id: row.id, initiative: row.initiative }));
    if (!updates.length) return notify("No saved rolled scores are available to restore.");
    if (await applyInitiativeUpdates(combat, updates)) notify("Saved initiative scores restored.", "info");
  } catch (error) {
    console.error(`${ID}: restore failed`, error);
    notify("Unable to restore initiative safely.", "error");
  } finally {
    busy = false;
  }
}

function ownedBy(combatant, user) {
  return canSeeHealth(combatant, user); // Same actor OWNER permission / hidden-token restriction.
}

function primaryGM() {
  const active = game.users?.filter?.(user => user.active && user.isGM) ?? [];
  return active.sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

async function executeAction(combat, combatantId, action, user) {
  if (!game.user.isGM || busy || !combat?.started) return false;
  const combatant = combat.combatants.get(combatantId);
  if (!combatant || !(user?.isGM || ownedBy(combatant, user))) return false;
  const round = Number(combat.round);
  const waiting = isDelayed(delayed(combat), combatantId, round);
  if (action === "delay" && (combat.combatant?.id !== combatantId || waiting
    || !Number.isFinite(combatant.initiative))) return false;
  if (action === "rejoin" && (!waiting || !combat.combatant)) return false;

  busy = true;
  try {
    if (action === "delay") {
      await combat.setFlag(ID, "delayed", withDelayed(delayed(combat), combatantId, round));
      // Normally advance once. preUpdateCombat redirects past anyone already
      // delaying; if none remain, the round advances and their delay expires.
      await combat.nextTurn();
      if (Number(combat.round) === round && combat.combatant?.id === combatantId) {
        await combat.setFlag(ID, "delayed", withoutDelayed(delayed(combat), combatantId));
        throw new Error("Native nextTurn did not advance; pending delay was reverted");
      }
      notify(`${combatant.name} is delaying until they rejoin or the round ends.`, "info");
    } else if (action === "rejoin") {
      const activeId = combat.combatant?.id;
      const { updates, reason } = activeId === combatantId
        ? { updates: [], reason: null }
        : planMove(combat.turns, combatantId, activeId, false);
      // A no-op move has no reason; other errors preserve the pending state.
      if (reason) { notify(reason); return false; }
      if (updates.length && !(await applyInitiativeUpdates(combat, updates))) return false;
      await combat.setFlag(ID, "delayed", withoutDelayed(delayed(combat), combatantId));
      notify(`${combatant.name} rejoined immediately after the current turn.`, "info");
    } else return false;
    repaint();
    return true;
  } catch (error) {
    console.error(`${ID}: ${action} failed`, error);
    notify(`Could not ${action} safely; check the tracker.`, "error");
    return false;
  } finally {
    busy = false;
  }
}

/** Players request their own turn changes from the active GM; no GM approval dialog. */
function requestAction(combat, combatantId, action) {
  const c = combat?.combatants.get(combatantId);
  if (!c || !combat?.started || !ownedBy(c, game.user)) return;
  if (game.user.isGM) return executeAction(combat, combatantId, action, game.user);
  if (!primaryGM() || !game.socket?.emit) return notify("An online GM and module socket are required for Delay/Rejoin.");
  const key = `${combat.id}:${combatantId}:${action}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    game.socket.emit(SOCKET, { type: "request", combatId: combat.id, combatantId, action, userId: game.user.id });
    // Permit a retry if no GM response arrives; socket requests are not durable.
    const timeout = setTimeout(() => inFlight.delete(key), 12000);
    timeout?.unref?.();
    notify(`${action === "delay" ? "Delay" : "Rejoin"} requested.`, "info");
  } catch (error) {
    inFlight.delete(key);
    console.error(`${ID}: socket request failed`, error);
    notify("Could not send the turn request.", "error");
  }
}

function setupSocket() {
  game.socket?.on?.(SOCKET, async payload => {
    if (!payload || typeof payload !== "object") return;
    if (payload.type === "result" && payload.userId === game.user.id) {
      inFlight.delete(`${payload.combatId}:${payload.combatantId}:${payload.action}`);
      if (payload.ok === false) notify(`${payload.action} request could not be completed; ask your GM.`, "warn");
      return;
    }
    if (payload.type !== "request" || !game.user.isGM || primaryGM()?.id !== game.user.id) return;
    if (!["delay", "rejoin"].includes(payload.action)) return;
    const requestingUser = game.users?.get?.(payload.userId);
    const combat = game.combats?.get?.(payload.combatId);
    if (!requestingUser || !requestingUser.active || requestingUser.isGM || !combat) return;
    const c = combat.combatants.get(payload.combatantId);
    // The GM checks eligibility and the *claimed* user's Actor ownership.
    // Foundry custom module socket payloads do not authenticate sender IDs;
    // this convenience request path is intended for trusted player groups.
    if (!c || !ownedBy(c, requestingUser)) return;
    const ok = await executeAction(combat, c.id, payload.action, requestingUser);
    game.socket?.emit?.(SOCKET, { type: "result", userId: requestingUser.id, combatId: combat.id, combatantId: c.id, action: payload.action, ok });
  });
}

function protectChanges() {
  Hooks.on("preUpdateCombatant", (combatant, changed, options) => {
    if (!blocksLockedInitiativeChange(combatant, changed, options, locked(combatant.parent), game.user.isGM)) return;
    if (Date.now() - lastWarning > 1800) {
      lastWarning = Date.now();
      notify("Initiative is locked. Ask the GM to unlock it, or use a drag handle.");
    }
    return false;
  });
  Hooks.on("preUpdateCombat", (combat, changed, options) => {
    if (locked(combat) && !(options?.wod20InitiativeToolBypass && game.user.isGM)
      && Object.hasOwn(changed, "combatants")
      && Array.isArray(changed.combatants)
      && changed.combatants.some(c => Object.hasOwn(c, "initiative"))) {
      notify("Bulk initiative edits are blocked while this encounter is locked.");
      return false;
    }
    skipDelayedTurn(combat, changed, delayed(combat));
  });
}

function trackerApp(app) {
  const cls = foundry.applications.sidebar.tabs.CombatTracker;
  return app instanceof cls;
}

function createToolbar(root, combat) {
  // The original beta returned early when the toolbar already existed. On
  // partial v14 renders that left the OLD Lock label in place indefinitely.
  root.querySelector(`.${ID}-toolbar`)?.remove();
  const doc = root.ownerDocument ?? document;
  const toolbar = doc.createElement("div");
  toolbar.className = `${ID}-toolbar`;
  if (game.user.isGM) {
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = `${ID}-lock`;
    toggle.textContent = statusLabel(locked(combat));
    toggle.dataset.locked = String(locked(combat));
    toggle.title = locked(combat) ? "GM: unlock initiative for this encounter" : "GM: save a snapshot and lock initiative";
    toggle.setAttribute("aria-label", locked(combat) ? "Unlock Initiative" : "Lock Initiative");
    toggle.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      return toggleLock(combat);
    });
    toolbar.append(toggle);
    if (combat.getFlag(ID, "snapshot")?.rows?.length) {
      const recovery = doc.createElement("button");
      recovery.type = "button";
      recovery.className = `${ID}-restore`;
      recovery.textContent = "Restore Order";
      recovery.title = "GM: restore initiative scores saved at the last lock";
      recovery.addEventListener("click", event => {
        event.preventDefault(); event.stopPropagation();
        return restore(combat);
      });
      toolbar.append(recovery);
    }
  } else if (locked(combat)) {
    toolbar.textContent = "Initiative is locked by the GM";
    toolbar.classList.add("is-locked");
  } else return;
  const tracker = root.querySelector("#combat-tracker, .combat-tracker, ol.combatants");
  const host = tracker?.parentElement ?? root;
  host.insertBefore(toolbar, tracker ?? host.firstChild);
}

function createDragHandles(root, combat) {
  if (!game.user.isGM) return;
  const waiting = delayed(combat);
  for (const row of root.querySelectorAll("li.combatant[data-combatant-id]")) {
    const c = combat.combatants.get(row.dataset.combatantId);
    if (!c || !Number.isFinite(c.initiative) || isDelayed(waiting,c.id,combat.round)) {
      row.querySelector(`.${ID}-handle`)?.remove();
      continue;
    }
    if (row.querySelector(`.${ID}-handle`)) continue;
    const doc = root.ownerDocument ?? document;
    const handle = doc.createElement("span");
    handle.className = `${ID}-handle`;
    handle.setAttribute("role", "img");
    handle.setAttribute("aria-label", "Drag to reorder initiative");
    handle.title = "Drag to move in initiative order (GM only)";
    handle.draggable = true;
    handle.innerHTML = '<i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>';
    row.insertBefore(handle, row.firstChild);
  }
}

function createRowExtras(root, combat, app) {
  const doc = root.ownerDocument ?? document;
  const pending = delayed(combat);
  const activeId = combat.combatant?.id;
  const healthEnabled = game.settings?.get?.(ID, "showHealth") !== false;
  for (const row of root.querySelectorAll("li.combatant[data-combatant-id]")) {
    row.querySelector(`.${ID}-row-actions`)?.remove();
    row.querySelector(`.${ID}-health`)?.remove();
    const c = combat.combatants.get(row.dataset.combatantId);
    if (!c) continue;
    const name = row.querySelector(".token-name, .combatant-name, h4, .name");
    const rowAnchor = name?.parentElement ?? row;
    if (healthEnabled) {
      const h = healthFor(c, game.user);
      if (h) {
        const span = doc.createElement("span");
        span.className = `${ID}-health`;
        span.title = `${h.details} (${Math.round(h.value)}/${Math.round(h.max)} remaining)`;
        span.setAttribute("role", "meter");
        span.setAttribute("aria-label", `Health: ${h.label}; ${Math.round(h.value)} of ${Math.round(h.max)} remaining`);
        span.setAttribute("aria-valuemin", "0");
        span.setAttribute("aria-valuemax", String(h.max));
        span.setAttribute("aria-valuenow", String(h.value));
        const count = doc.createElement("span");
        count.className = `${ID}-health-count`;
        count.textContent = `${Math.round(h.value)}/${Math.round(h.max)}`;
        const track = doc.createElement("span");
        track.className = `${ID}-health-track`;
        const fill = doc.createElement("span");
        fill.className = `${ID}-health-fill`;
        fill.style.width = `${Math.round(100 * h.value / h.max)}%`;
        fill.dataset.severity = h.value / h.max <= 0.25 ? "critical" : h.value / h.max <= 0.5 ? "injured" : "healthy";
        track.append(fill);
        span.append(count, track);
        rowAnchor.append(span);
      }
    }
    if (!combat.started || !ownedBy(c, game.user)) continue;
    const waiting = isDelayed(pending, c.id, combat.round);
    if (!waiting && (c.id !== activeId || !Number.isFinite(c.initiative))) continue;
    const actions = doc.createElement("span");
    actions.className = `${ID}-row-actions`;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = waiting ? `${ID}-rejoin` : `${ID}-delay`;
    button.textContent = waiting ? "Rejoin" : "Delay";
    button.setAttribute("aria-label", `${waiting ? "Rejoin" : "Delay"} turn: ${c.name}`);
    button.title = waiting
      ? "Rejoin immediately after the current combatant; this becomes your new initiative position"
      : "Yield your current turn; rejoin later this round or forfeit it at the next round";
    button.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      if (currentCombat(app)?.id !== combat.id) return;
      return requestAction(combat, c.id, waiting ? "rejoin" : "delay");
    });
    actions.append(button);
    rowAnchor.append(actions);
  }
}

function attachDragListeners(root, app) {
  if (!game.user.isGM || root.dataset.wod20InitiativeToolReady === "true") return;
  root.dataset.wod20InitiativeToolReady = "true";
  let dragged = null;
  const clearClasses = () => root.querySelectorAll(`.${ID}-drop-above,.${ID}-drop-below`).forEach(el =>
    el.classList.remove(`${ID}-drop-above`, `${ID}-drop-below`));
  const clear = () => { clearClasses(); dragged = null; };
  root.addEventListener("dragstart", event => {
    const handle = event.target.closest?.(`.${ID}-handle`);
    if (!handle || !event.dataTransfer) return;
    dragged = handle.closest("li.combatant[data-combatant-id]")?.dataset.combatantId;
    if (!dragged) return;
    event.dataTransfer.setData(DRAG_MIME, dragged);
    event.dataTransfer.effectAllowed = "move";
    event.stopPropagation();
  }, true);
  root.addEventListener("dragover", event => {
    if (!dragged) return;
    const row = event.target.closest?.("li.combatant[data-combatant-id]");
    if (!row || row.dataset.combatantId === dragged) return;
    event.preventDefault(); event.stopPropagation();
    clearClasses();
    const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    row.classList.add(`${ID}-drop-${before ? "above" : "below"}`);
    event.dataTransfer.dropEffect = "move";
  }, true);
  root.addEventListener("drop", async event => {
    if (!dragged) return;
    const row = event.target.closest?.("li.combatant[data-combatant-id]");
    event.preventDefault(); event.stopPropagation();
    const movedId = dragged;
    clear();
    if (!row || movedId === row.dataset.combatantId || busy) return;
    const combat = currentCombat(app);
    if (!combat || !combat.combatants?.get(movedId) || !combat.combatants?.get(row.dataset.combatantId)) return;
    if (isDelayed(delayed(combat), movedId, combat.round)) return notify("Use Rejoin to move a delayed combatant.");
    const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    const previousTurns = combat.turns.slice();
    const { updates, reason } = planMove(previousTurns, movedId, row.dataset.combatantId, before);
    if (reason) return notify(reason);
    if (!updates.length) return;
    busy = true;
    try { await applyInitiativeUpdates(combat, updates, { movedId, previousTurns }); }
    catch (error) { console.error(`${ID}: drag failed`, error); notify("Unable to reorder initiative.", "error"); }
    finally { busy = false; }
  }, true);
  root.addEventListener("dragend", clear, true);
}

function installTrackerControls(app, root) {
  if (!game.ready || !trackerApp(app)) return;
  const combat = currentCombat(app);
  if (!combat || !root?.querySelector) return;
  installTopTurnControls({
    root, combat, isGM: game.user.isGM, getViewedCombat: () => currentCombat(app), notify
  });
  createToolbar(root, combat);
  createDragHandles(root, combat);
  createRowExtras(root, combat, app);
  attachDragListeners(root, app);
}

Hooks.once("init", () => {
  game.settings.register(ID, "showHealth", {
    name: "Show health in Combat Tracker",
    hint: "Show a compact read-only health indicator to the GM and each Actor's owners. Other players cannot see enemy health.",
    scope: "world", config: true, type: Boolean, default: true, onChange: repaint
  });
  protectChanges();
});
Hooks.once("ready", setupSocket);
Hooks.on("renderCombatTracker", installTrackerControls);
Hooks.on("renderApplicationV2", installTrackerControls);
Hooks.on("updateCombat", (combat, changed) => {
  if (Object.keys(changed).some(key => key === "flags" || key.startsWith(`flags.${ID}`))) repaint();
});
Hooks.on("updateActor", actor => {
  if (game.combat?.combatants?.contents?.some(c => c.actor?.id === actor.id)) repaint();
});
Hooks.on("updateToken", token => {
  if (game.combat?.combatants?.contents?.some(c => c.token?.id === token.id)) repaint();
});
