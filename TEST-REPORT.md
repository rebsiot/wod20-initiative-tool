# WoD20 Initiative Tool v0.1.4 — Test Report

**Candidate:** v0.1.4 Beta, 2026-10-20. **Module ID:** `wod20-initiative-tool`. **Target:** Foundry VTT v14, system-agnostic initiative guard and optional WoD20 health display.

**Authoritative input:** the exact verified `v0.1.3` GitHub release source commit `83ccf915d5de4a0f48433d618a86f294c3a0485d` and its release ZIP SHA-256 `0a701f342b9a8a97cd0749d539b0274511d3366ed7760e9b2d1dfbbae38d63ae`. The local ZIP was inspected before modification.

## Automated/mock-tested

- Node ES-module syntax checked: passed.
- Node test suite: **54 passed, 0 failed** (including 200 seeded drag-order cases within one test).
- Drag uses an available integer gap when possible; consecutive/tied scores are re-ranked using whole numbers, with no fractions.
- Seeded batch of **200 drag cases**, including ties and legacy fractional values, preserves the requested order and produces safe integers.
- Existing earlier tests cover lock/update guard, snapshots, turn navigation, Delay/Rejoin and GM socket request simulation, client permissions and health, v14 tracker mock UI, source/manifest identity and active-turn regression.
- Lock control's short text updates immediately and survives tracker rerenders. Heavy lock-state border styling has been removed.
- Package checked for a manifest at ZIP root, expected entry points, new versioned URLs, no private assets/credentials and ZIP integrity.

## Confirmed live — not yet run for v0.1.4

User reported drag reordering works in the earlier installed beta and supplied a screenshot showing the prior oversized lock label. This is valuable design feedback, **not a live test** of the new build. Exact current installed module/system versions and player/GM behavior have not been re-audited.

## First live test after backing up world data

In a disposable Foundry v14 world, enable v0.1.4. With a GM and player client, roll three combatants (e.g. initiatives 12, 11, 10). Confirm the short Lock/Unlock button, then drag the last combatant between the others and confirm integer scores and the active turn remain correct. Delay and Rejoin that combatant in a gapless order. Verify native turn navigation and health indicators; Restore Order should recover its stored snapshot without changing Actors.

**Rollback:** Disable module and reinstall the `v0.1.3` release from the backed-up module folder if needed. A module rollback does not revert Combatant initiative scores/flags; restore a world snapshot or intentionally use Restore Order before disabling.
