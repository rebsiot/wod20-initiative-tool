# WoD20 Initiative Tool v0.1.3 (Beta) — Better turn control

The Lock Initiative button now explicitly shows whether initiative is locked and what clicking it will do. Dragging the current combatant no longer makes the tracker follow that character around the order.

## What's changed

- **Delay** the current combatant, then **Rejoin** later this round from the player or GM tracker. Rejoin places them after the person currently acting; an unused delay expires at the next round.
- A compact **health bar** shows remaining health alongside eligible combatants. NPC health remains GM-only unless the player owns the Actor. WoD20 uses its actual wound levels; generic numeric HP is supported elsewhere.
- Existing drag handles, initiative snapshots, Restore, and top Previous/Next Turn controls are retained.

## Before upgrading

**This is still a beta.** Back up the world and previous module folder; first try it with a GM and player in a test world. 46 automated/mock tests pass, but the new player requests, active-turn selection and in-game tracker presentation have **not** been tested in a real Foundry v14 session. Delay/Rejoin adds per-encounter flags and Rejoin may change Combatant initiative scores. Disabling the module does not undo those changes.

## Install

Version-pinned Foundry beta manifest:

`https://raw.githubusercontent.com/rebsiot/wod20-initiative-tool/v0.1.3/module.json`

Or install the full `wod20-initiative-tool-v0.1.3-beta.zip` under `Data/modules/wod20-initiative-tool`. See README for first tests, limitations and rollback instructions.
