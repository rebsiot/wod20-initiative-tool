# Changelog

## v0.1.2 (Beta) — 2026-10-19

- Renamed module, display name and installation folder to **WoD20 Initiative Tool** / `wod20-initiative-tool` before first campaign installation.
- Changed the per-encounter flags namespace and internal DOM/CSS identifiers to the new module ID. Earlier `stl-initiative-guard` beta flags are not automatically migrated.
- Preserved lock/unlock, snapshot Restore, GM drag ordering, and top Previous/Next Turn navigation. No changes to Foundry or WoD20 dice logic.
- Prepared the public beta distribution with a versioned GitHub release download and Foundry manifest. Real v14 GM/player tests remain pending.


## v0.1.1 (Beta) — 2026-10-19

- Added compact **Previous Turn** and **Next Turn** buttons above the combatant list for the GM after combat begins.
- Used Foundry v14 native `Combat.previousTurn()` / `Combat.nextTurn()` methods; the bottom native controls are untouched.
- Guarded against rapid double-clicks and stale encounters when switching between combats.
- Preserved the original beta per-combat initiative lock, snapshot restore, drag ordering and then-current module ID/flags.
- Added mock DOM/navigation tests. Actual Foundry v14 GM/player tests remain pending.

## v0.1.0 (Beta) — 2026-10-19

- Added GM-scoped per-encounter initiative lock/unlock and saved score snapshot.
- Added GM drag-to-reorder using Foundry Combatant initiative values.
- Added snapshot restoration with confirmation and no Actor changes.
- Allowed first rolls for late/unrolled combatants while keeping previously rolled values locked.
- Preserved native Foundry round/turn controls and left game-system initiative roll methods unchanged.
- Targeted Foundry v14; live Foundry v14/connected-player regression **not yet run**.
