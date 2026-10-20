# Changelog

## v0.1.3 (Beta) — 2026-10-20

- **Fixed:** Lock Initiative button now updates its action label immediately and on every tracker render. Removed ambiguous padlock icon; shows both the initiative state and the action clearly.
- **Changed:** Dragging the current combatant hands the turn to the next previously scheduled eligible combatant instead of following the moved one. Dragging other combatants continues to preserve the current actor. Retained working drag handles and existing tie/midpoint ordering.
- **Added:** Delay and Rejoin action buttons for the active combatant / delayed actor. Delay skips a turn during the current round. Rejoin inserts immediately after the currently active combatant and sets a new initiative position. Delays expire at the next round.
- **Added:** Owning players can request their own Delay/Rejoin via one active GM using the native Foundry module socket. GM can operate any participant. No GM approval dialog is added.
- **Added:** Read-only miniature health bar/count to the Combat Tracker, based on WoD20 M20/V20 native damage and health levels when available, and generic numeric HP in other systems. Private NPC health is not disclosed to non-owning players. A world setting can turn the indicator off.
- **Preserved:** Foundry Combat Tracker/turn-navigation methods, native roll path, top Previous/Next controls, footer, lock/snapshot flags and GM Restore. No Actor data migrations.
- **Tests:** 46 automated/mock tests passed. Live Foundry v14 GM/player verification not yet performed; beta status remains.
- **Upgrade:** Back up your world. Use the same module ID/folder `wod20-initiative-tool`. New pending delay flag is added only on use.
- **Rollback:** Return to v0.1.2 source/ZIP if needed and restore the world snapshot for any Combatant order edits; changing module code alone does not revert in-world score/flag changes.

## v0.1.2 (Beta) — 2026-10-19

- Renamed module, display name and installation folder to **WoD20 Initiative Tool** / `wod20-initiative-tool` before first campaign installation.
- Changed the encounter flags namespace and internal DOM/CSS identifiers to the new ID; no migration of old `stl-initiative-guard` flags.
- Preserved lock/unlock, snapshot Restore, GM drag ordering, and top Previous/Next Turn navigation. Foundry v14 live tests still pending at the time of this release.

## v0.1.1 (Beta) — 2026-10-19

- Added top GM **Previous Turn** / **Next Turn** controls that call native Foundry APIs; native footer untouched.
- Preserved lock, snapshot restore and drag handles.

## v0.1.0 (Beta) — 2026-10-19

- Initial GM Lock/Unlock, snapshot Restore and drag ordering test build (original prototype ID).
