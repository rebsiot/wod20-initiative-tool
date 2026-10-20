/**
 * Compact GM turn controls above the combatant list.
 * The existing Foundry tracker footer stays untouched. Use native Combat
 * methods so turn/round hooks and any game-system timing continue normally.
 */
const NAV_CLASS = "wod20-initiative-tool-turn-navigation";
const TRACKER_SELECTOR = "#combat-tracker, ol.combatants, .combatants-directory, .combat-tracker";

/** Inject duplicate, GM-only Previous/Next Turn controls for the viewed Combat. */
export function installTopTurnControls({ root, combat, isGM, getViewedCombat, notify }) {
  if (!root?.querySelector) return;
  // Tracker apps can update their parts independently. Recreate the controls
  // when a part is rendered, so their disabled state cannot become stale.
  root.querySelector(`.${NAV_CLASS}`)?.remove();

  if (!isGM || !combat?.started || !combat.turns?.length) return;
  const tracker = root.querySelector(TRACKER_SELECTOR);
  if (!tracker?.parentElement) return;

  const doc = root.ownerDocument ?? document;
  const nav = doc.createElement("div");
  nav.className = NAV_CLASS;
  nav.setAttribute("role", "group");
  nav.setAttribute("aria-label", "GM combat turn navigation");
  let navigating = false;

  function button(label, icon, method) {
    const control = doc.createElement("button");
    control.type = "button";
    control.className = `${NAV_CLASS}-button`;
    control.title = `${label} (GM)`;
    control.setAttribute("aria-label", label);
    control.innerHTML = `<i class="fa-solid fa-${icon}" aria-hidden="true"></i><span>${label}</span>`;
    control.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      if (navigating || !isGM || control.disabled) return;
      // The GM may have selected a different encounter between render and click.
      if (getViewedCombat()?.id !== combat.id || !combat.started) return;
      navigating = true;
      for (const el of nav.children) el.disabled = true;
      try {
        // Foundry handles round boundaries, round/turn hooks, turn markers,
        // system integrations, and combat document updates here.
        await combat[method]();
      } catch (error) {
        console.error("wod20-initiative-tool: failed to navigate turn", error);
        notify("Could not change combat turn.", "error");
      } finally {
        navigating = false;
        // The normal CombatTracker render refreshes state after a turn change.
        for (const el of nav.children) el.disabled = false;
        previous.disabled = combat.round <= 1 && (combat.turn ?? 0) <= 0;
      }
    });
    return control;
  }

  const previous = button("Previous Turn", "chevron-left", "previousTurn");
  const next = button("Next Turn", "chevron-right", "nextTurn");
  previous.disabled = combat.round <= 1 && (combat.turn ?? 0) <= 0;
  nav.append(previous, next);
  tracker.parentElement.insertBefore(nav, tracker);
}
