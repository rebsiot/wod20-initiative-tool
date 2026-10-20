# WoD20 Initiative Tool (Beta) — v0.1.3

A lightweight Foundry VTT v14 module to protect the Combat Tracker's initiative scores and make combat order easier to manage. It works with WoD20 M20/V20 **and other game systems**; the native Foundry combat model remains authoritative.

## Features

- **Clear initiative locking.** The GM control reads **Initiative UNLOCKED — Lock Initiative** before locking and **Initiative LOCKED — Unlock Initiative** afterward. No ambiguous padlock. An encounter-specific score snapshot is saved whenever you lock.
- **Drag to reorder.** The GM can drag a participant using the grip handle. Dragging the *current* combatant advances to the next eligible combatant from the prior order rather than following the moved participant; dragging someone else preserves the current actor.
- **Delay / Rejoin.** The active combatant or GM can click **Delay** to yield that turn. Delayed combatants are skipped when the tracker advances, including with the native footer. **Rejoin** (for the controlling player or GM) inserts that participant immediately **after the combatant currently acting**, updating its initiative score to the new position. The current combatant finishes normally; the rejoining person acts next. If still waiting at the start of the next round, their delayed action expires and the prior initiative order is preserved.
- **Read-only health indicator.** Shows a small remaining-health count/bar in the tracker. The GM sees tracked participants' health; players see health only for Actors they own, and never for hidden entries. Uses WoD20's actual health boxes, Bashing/Lethal/Aggravated damage and wound severity for Mage/Vampire where available. Falls back to common native numeric HP fields in other systems. Unsupported health tracks are left blank, not guessed.
- **Convenient controls.** Top **Previous Turn / Next Turn** duplicates the native controls. Original bottom tracker buttons, system rolls, snapshots/Restore, and other Combatant fields are retained.

## Install or update (beta)

1. **Back up the Foundry world and current module folder.** Dragging, Rejoin and Restore can change Combatant initiative numbers, and Delay writes temporary flags to Combat documents. Disabling a module does not undo those world changes.
2. In **Foundry Setup → Add-on Modules → Install Module**, use the version-pinned beta manifest:

   `https://raw.githubusercontent.com/rebsiot/wod20-initiative-tool/v0.1.3/module.json`

   Or stop Foundry and extract the complete release ZIP with `module.json` directly inside `Data/modules/wod20-initiative-tool/`. For the St. Louis Samba share this is `Z:\Data\modules\wod20-initiative-tool\`.
3. Enable **WoD20 Initiative Tool (Beta)** in **Manage Modules** for a **test world**. Refresh the GM and player clients.
4. Run the smoke test below **before** enabling the upgrade in the campaign.

The module ID `wod20-initiative-tool` and its existing `flags.wod20-initiative-tool.locked` / `.snapshot` are unchanged from v0.1.2; no import or migration is required. The new `.delayed` flag is set only when someone clicks Delay. Do not enable the older `stl-initiative-guard` prototype alongside this module.

## First live test (GM + player)

1. Start a disposable encounter with three rolled participants, and **Lock Initiative**. Verify the button immediately becomes **Initiative LOCKED — Unlock Initiative**. Then unlock; verify the reverse. Confirm ordinary rerolls do not change existing scores when locked.
2. Drag the current combatant downward; confirm the tracker advances to the previous order's next eligible person, not the dragged one. Drag a different combatant and verify the active turn does not jump.
3. Click **Delay** on the current participant. Verify the next person becomes active, including if another participant is already delaying. From the owning player's tracker, click **Rejoin** and verify they appear directly after the current turn, not immediately interrupting it. Advance and verify they act next.
4. Repeat Delay at the end of a round; confirm it expires as round advances, with no turn granted to the delayed actor in the old round.
5. Check the health bar while taking/recovering damage. Compare one Mage/Vampire health track and one other Actor. A non-owning player must **not** see enemy/hidden health.
6. Open the popped-out tracker and check all controls, then test the native bottom Previous/Next buttons. Finally use **Restore Order** to recover snapshot scores.

## Settings and behavior

**Show health in Combat Tracker** is an enabled-by-default **world setting** under Module Settings. Health information is read only. It does not write Actor health or replace the separate WoD20 Health Hover module. Players still need an online GM for player-initiated Delay/Rejoin; requests are executed by one active GM through the module socket, with Actor ownership checks.

The initiative lock guards normal standard Foundry document updates on the client. It is **not a server-side security boundary** and may not prevent another module from displaying a reroll prompt. The module's lightweight socket request mechanism is appropriate for **trusted player groups**; custom socket messages do not authenticate a sender's claimed user ID, so it should not be treated as secure delegation in an adversarial game.

## Known beta limitations

- v0.1.3 has **automated/mock tests only**. No Foundry v14 live GM/player or cross-module session was available for verification. Native tracker DOM and turn/round event behavior need a real test, especially with Monk's Combat Details or other tracker replacements.
- Drag/rejoin uses **numeric Combatant initiative** and may introduce fractional values when inserting between participants, preserving ties when possible. Snapshot Restore stores original scores, but is not an undo history of every step.
- Delaying only holds an action **within the current round**. An unclaimed delayed turn expires when that round ends. Rejoining joins **after** the current combatant rather than preempting their action.
- Only rolled combatants can Delay or use the drag handle. Wraith Corpus and Changeling chimerical health and unusual/non-numeric game systems will not show a WoD20 physical-health value.
- Rejoin through the owning player's button needs a connected GM. If a GM disconnects mid-request or native combat update fails, verify the order before proceeding.

## Rollback

Before disabling the module, unlock or use **Restore Order** if you need to undo changed initiative scores. The prior v0.1.2 public beta release remains at [Releases](https://github.com/rebsiot/wod20-initiative-tool/releases). Stop Foundry, back up the world and module folder, replace the module from the prior release, then restart. **Code rollback does not undo stored Combat flags or altered initiative scores**; restore a matching world snapshot if the saved snapshot is insufficient.

## Development and evidence

Run `node --check scripts/*.mjs` and `node --test tests/*.test.mjs` from the module folder (Node 22 or later for the test harness). See [CHANGELOG.md](CHANGELOG.md), [TEST-REPORT.md](TEST-REPORT.md), and [RELEASE-NOTES.md](RELEASE-NOTES.md). This public repository has no declared open-source license; public visibility does not grant redistribution rights.
