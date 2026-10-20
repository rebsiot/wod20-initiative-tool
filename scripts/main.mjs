import { planMove, blocksLockedInitiativeChange } from "./order.mjs";
import { installTopTurnControls } from "./top-turn-controls.mjs";

const ID = "wod20-initiative-tool";
const DRAG_MIME = "application/x-wod20-initiative-tool";
const notify = (message, level = "warn") => ui.notifications?.[level]?.(`[WoD20 Initiative Tool] ${message}`);
let lastWarning = 0;
let busy = false;

function locked(combat) {
  return combat?.getFlag(ID, "locked") === true;
}

function currentCombat(app) {
  return app?.viewed ?? game.combats?.viewed ?? game.combat ?? null;
}

function repaint() {
  if (ui.combat?.rendered) ui.combat.render({ force: true }).catch(console.error);
  const popout = ui.combat?.popout;
  if (popout?.rendered) popout.render({ force: true }).catch(console.error);
}

async function toggleLock(combat) {
  if (!game.user.isGM || busy) return;
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
      await combat.update({
        [`flags.${ID}.snapshot`]: snapshot,
        [`flags.${ID}.locked`]: true
      });
      notify("Initiative locked. Existing scores cannot be rerolled or cleared.", "info");
    }
    repaint();
  } catch (error) {
    console.error(`${ID}: toggle failed`, error);
    notify("Unable to change the initiative lock.", "error");
  } finally {
    busy = false;
  }
}

async function confirmRestore() {
  const dialog = foundry.applications.api.DialogV2;
  return dialog.confirm({
    window: { title: "Restore Initiative Snapshot" },
    content: "<p>Restore the initiative scores saved when this encounter was last locked?</p><p>Only those original combatants will be affected. New combatants will remain unchanged.</p>",
    rejectClose: false
  });
}

async function applyInitiativeUpdates(combat, updates) {
  if (!game.user.isGM || !updates.length || busy) return false;
  busy = true;
  try {
    const activeId = combat.combatant?.id ?? null;
    const done = await combat.updateEmbeddedDocuments("Combatant", updates, { wod20InitiativeToolBypass: true });
    if (done?.length !== updates.length) {
      notify("Some initiative changes were not applied; inspect the tracker.", "warn");
    }
    // The native tracker sorts by initiative. Preserve the active combatant
    // rather than unintentionally giving another token the current turn.
    if (combat.started && activeId && combat.combatant?.id !== activeId) {
      const newIndex = combat.turns.findIndex(c => c.id === activeId);
      if (newIndex >= 0 && newIndex !== combat.turn) await combat.update({ turn: newIndex });
    }
    repaint();
    return done?.length === updates.length;
  } catch (error) {
    console.error(`${ID}: initiative update failed`, error);
    notify("Could not update initiative safely.", "error");
    return false;
  } finally {
    busy = false;
  }
}

async function restore(combat) {
  if (!game.user.isGM || busy) return;
  const snapshot = combat.getFlag(ID, "snapshot");
  if (!Array.isArray(snapshot?.rows) || !snapshot.rows.length) return notify("No saved snapshot for this encounter.");
  if (!(await confirmRestore())) return;
  const updates = snapshot.rows
    .filter(row => row.initiative !== null && Number.isFinite(row.initiative) && combat.combatants.get(row.id))
    .map(row => ({ _id: row.id, initiative: row.initiative }));
  if (!updates.length) return notify("No saved rolled scores are available to restore.");
  if (await applyInitiativeUpdates(combat, updates)) notify("Saved initiative scores restored.", "info");
}

function protectChanges() {
  Hooks.on("preUpdateCombatant", (combatant, changed, options) => {
    if (!blocksLockedInitiativeChange(combatant, changed, options, locked(combatant.parent), game.user.isGM)) return;
    if (Date.now() - lastWarning > 1800) {
      lastWarning = Date.now();
      notify("Initiative is locked. Ask the GM to unlock it or use the drag handle.");
    }
    return false;
  });
  // Rare modules may replace the combatants collection in a parent update.
  // Do not silently allow that path to reset scores in a locked encounter.
  Hooks.on("preUpdateCombat", (combat, changed, options) => {
    if (!locked(combat) || (options?.wod20InitiativeToolBypass && game.user.isGM)) return;
    if (!Object.hasOwn(changed, "combatants")) return;
    const incoming = changed.combatants;
    if (!Array.isArray(incoming) || !incoming.some(c => Object.hasOwn(c, "initiative"))) return;
    notify("Bulk initiative edits are blocked while this encounter is locked.");
    return false;
  });
}

function trackerApp(app) {
  const cls = foundry.applications.sidebar.tabs.CombatTracker;
  return app instanceof cls;
}

function createToolbar(root, combat) {
  if (root.querySelector(`.${ID}-toolbar`)) return;
  const toolbar = document.createElement("div");
  toolbar.className = `${ID}-toolbar`;
  const isLocked = locked(combat);
  if (game.user.isGM) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = `${ID}-lock`;
    toggle.title = isLocked ? "GM: Unlock initiative for this encounter" : "GM: Save a snapshot and lock initiative";
    toggle.innerHTML = `<i class="fa-solid fa-${isLocked ? "lock" : "lock-open"}" aria-hidden="true"></i> ${isLocked ? "Unlock Initiative" : "Lock Initiative"}`;
    toggle.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleLock(combat);
    });
    toolbar.append(toggle);
    if (combat.getFlag(ID, "snapshot")?.rows?.length) {
      const recovery = document.createElement("button");
      recovery.type = "button";
      recovery.className = `${ID}-restore`;
      recovery.title = "GM: Restore scores saved when initiative was last locked";
      recovery.innerHTML = `<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Restore`;
      recovery.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        restore(combat);
      });
      toolbar.append(recovery);
    }
  } else if (isLocked) {
    toolbar.textContent = "Initiative locked by GM";
    toolbar.classList.add("is-locked");
  } else return;
  // Insert near the tracker list rather than into a button/control owned by core.
  const tracker = root.querySelector("#combat-tracker, .combat-tracker, ol.combatants");
  const host = tracker?.parentElement ?? root;
  host.insertBefore(toolbar, tracker ?? host.firstChild);
}

function createDragHandles(root, combat) {
  if (!game.user.isGM) return;
  for (const row of root.querySelectorAll("li.combatant[data-combatant-id]")) {
    const c = combat.combatants.get(row.dataset.combatantId);
    if (!c || !Number.isFinite(c.initiative) || row.querySelector(`.${ID}-handle`)) continue;
    const handle = document.createElement("span");
    handle.className = `${ID}-handle`;
    handle.setAttribute("role", "img");
    handle.setAttribute("aria-label", "Drag to reorder initiative");
    handle.title = "Drag to move in initiative order (GM only)";
    handle.draggable = true;
    handle.innerHTML = '<i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>';
    row.insertBefore(handle, row.firstChild);
  }
}

function attachDragListeners(root, combat, app) {
  if (!game.user.isGM || root.dataset.wod20InitiativeToolReady === "true") return;
  root.dataset.wod20InitiativeToolReady = "true";
  let dragged = null;
  const clear = () => {
    root.querySelectorAll(`.${ID}-drop-above,.${ID}-drop-below`).forEach(el =>
      el.classList.remove(`${ID}-drop-above`, `${ID}-drop-below`));
    dragged = null;
  };
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
    event.preventDefault();
    event.stopPropagation();
    clearClasses();
    const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    row.classList.add(`${ID}-drop-${before ? "above" : "below"}`);
    event.dataTransfer.dropEffect = "move";
  }, true);
  function clearClasses() {
    root.querySelectorAll(`.${ID}-drop-above,.${ID}-drop-below`).forEach(el =>
      el.classList.remove(`${ID}-drop-above`, `${ID}-drop-below`));
  }
  root.addEventListener("drop", async event => {
    if (!dragged) return;
    const row = event.target.closest?.("li.combatant[data-combatant-id]");
    event.preventDefault();
    event.stopPropagation();
    const movedId = dragged;
    clear();
    if (!row || movedId === row.dataset.combatantId) return;
    // Reject stale DnD after selecting another encounter in the same tracker.
    if (app.viewed?.id !== combat.id) return;
    const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    const { updates, reason } = planMove(combat.turns, movedId, row.dataset.combatantId, before);
    if (reason) return notify(reason);
    if (updates.length) await applyInitiativeUpdates(combat, updates);
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
  attachDragListeners(root, combat, app);
}

Hooks.once("init", protectChanges);
Hooks.on("renderCombatTracker", installTrackerControls);
Hooks.on("renderApplicationV2", installTrackerControls);
Hooks.on("updateCombat", (combat, changed) => {
  if (Object.keys(changed).some(key => key === "flags" || key.startsWith(`flags.${ID}`))) repaint();
});
