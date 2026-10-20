# WoD20 Initiative Tool v0.1.4 (Beta) — Less noise, whole-number initiative

The initiative lock button now says **Lock Initiative** or **Unlock Initiative**. It has the same quiet styling as Restore Order and no oversized lock-status caption.

Dragging a combatant or using Rejoin now assigns **whole-number initiative scores only**. Where there is space, only the moved combatant's score changes. When scores are consecutive or tied, enough ranks are reassigned to preserve the order without decimals. Dragging the current combatant still continues to the previously scheduled next person.

All other v0.1.3 features remain: Delay/Rejoin, read-only health indicator, snapshots/Restore, and top Previous/Next Turn controls.

## Before upgrading

**Beta, not yet live-tested for v0.1.4.** Back up your world and module folder first. Initiative reordering can change several Combatant scores where there is no integer gap. Existing decimals from older releases are not migrated automatically. The next explicit drag normalizes existing rolled scores as part of the requested reorder; **Restore Order preserves the exact saved snapshot**, including older decimal values.

Run a three-combatant encounter in a test world with GM and player clients. Check Lock → Unlock, drag across consecutive scores, then Delay → Rejoin and confirm the active turn and whole-number order. Test the health indicator and native turn controls as well.

## Install

Version-pinned Foundry beta manifest:

`https://raw.githubusercontent.com/rebsiot/wod20-initiative-tool/v0.1.4/module.json`

Or extract `wod20-initiative-tool-v0.1.4-beta.zip` into `Data/modules/wod20-initiative-tool/`. See README for detailed upgrade and rollback steps. The older v0.1.3 release is retained for rollback; reverting the module does not undo changed world-document initiative numbers.
