# WoD20 Initiative Tool v0.1.3 — Test report

**Date:** 2026-10-20  
**Exact source baseline:** Published `rebsiot/wod20-initiative-tool` v0.1.2 commit `b668c2fe0414f87c39ef938aabd46e62aa8eef64` and the matching 19,471-byte published beta ZIP (`SHA-256 c57d49cdd6ffd65237868f2b95f0b8602be07d55772e82d2499c8b7f4852267a`). Working module ID remains `wod20-initiative-tool`.  
**Target:** Foundry v14; native Foundry Combatant/Combat API; WoD20 `worldofdarkness` v7.3.x health schema read-only.

## Automated/mock-tested — Passed

- Node ES-module syntax for all source modules.
- `node --test tests/*.test.mjs` — **46 passed; zero failed**.
- Existing initiative drag numeric planning, tie handling, locked-score bypass, new/late first-roll protections, native top Previous/Next controls and stale encounter checks.
- Full mocked tracker: lock label changes immediately and remains correct after rerender; no toolbar duplication; snapshot state persists; Delay advances turn; Rejoin moves after active actor and then becomes next; health indicators stay singular.
- User-reported drag scenario: moving the acting combatant does not follow them; the previously next person becomes active. Reordering someone else preserves current actor.
- Round policy: delayed participants skipped, skip chains, expiry at next round, backward navigation. No effect on unrelated updates.
- GM and controlling-player health visibility checks, hidden combatants, WoD20 damage/extra boxes, generic HP fallback and absent/invalid health values.
- Mock owning-player request to GM over the module socket; rejected request targeting a different owner's Actor.
- Package identity, manifest entry points, module ID, ZIP integrity and no unauthorized content.

## Confirmed live — Not yet run for v0.1.3

The user reported drag reordering working and stale lock label in the earlier installed beta, but no exact live Foundry/system/module version or new v0.1.3 live workflow has been verified. Node/mocked hooks do not establish real Foundry timing or permissions.

## Required first real test

Use a disposable Foundry v14 encounter with a GM + player logged in, 3 combatants with rolled initiatives and a saved world backup. Lock, unlock, and reroll. Drag the active combatant and confirm the next person is correct. Delay from a player's row and Rejoin during another combatant's turn. Verify round-edge expiration, a real health update and actor-owner visibility, top and footer turn controls, and whether other tracker modules interoperate. Inspect console for errors. Do **not** change the live campaign until these pass.

## Known risks and rollback

- Intercepting a native turn transition at `preUpdateCombat` is best-effort and needs Foundry v14 validation with additional modules that wrap `Combat.nextTurn`/`previousTurn`. Wounds/HP in unsupported systems are intentionally omitted.
- Reordering or Rejoin changes initiative numbers; a snapshot or world backup is required to restore them. Delays are stored as per-round flags on Combat; no Actors are changed.
- GM socket request uses the player's claimed user ID (module sockets do not authenticate sender identity). Use only with trusted player groups. Server-side permission enforcement is not supplied by this client module.
- Rollback: recover the prior v0.1.2 module folder/ZIP; restore the world snapshot if necessary. Disabling code does not remove Combat flags or reverse changes to Combatants.

**Deployment:** Not installed in the user's Foundry environment as part of this build. GitHub publication status must be verified separately.
