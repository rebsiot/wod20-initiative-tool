# WoD20 Initiative Tool (Beta)

A compact, **system-agnostic** initiative utility for Foundry VTT v14. Despite the WoD20 name, the module relies on Foundry's native combat/Combatant APIs rather than the WoD20 dice system.

## Features

- GM **Lock / Unlock Initiative** for each encounter; a lock prevents ordinary rerolls and bulk resets from overwriting existing scores.
- GM drag handles to reorder rolled combatants.
- Save an initiative snapshot on locking and restore it later.
- **Previous Turn** / **Next Turn** controls above the combatant list while preserving the native footer.

## v0.1.2 beta — publication pending

The **full installable ZIP and source are prepared but not yet uploaded to this GitHub repository**. Do not install using a GitHub manifest or release link until a matching release asset exists. The beta ZIP can be obtained in the project conversation.

**Tests:** 21 automated tests passed; real Foundry v14 GM/player testing remains pending. Test in a disposable world first. Locking does not prevent another module from displaying a reroll *prompt*, only guarded initiative writes; it is not server-side security enforcement.

## Installation once the release is published

Use Foundry Setup → Add-on Modules → Install Module, then paste the manifest URL once its associated downloadable ZIP is live:

`https://raw.githubusercontent.com/rebsiot/wod20-initiative-tool/main/module.json`

Alternatively, extract the complete release ZIP into `Data/modules/wod20-initiative-tool/` with `module.json` directly inside that folder. Back up the world before enabling it, and test with GM and player clients.

## Rollback

The module writes flags to Combat documents and drag actions can change numeric Combatant initiative. Use Restore before disabling, or revert to a world backup. Simply disabling the module does not undo initiative edits.

## Release status

- Repository: public
- Module ID: `wod20-initiative-tool`
- Target: Foundry v14
- Current beta source/package: v0.1.2, prepared locally
- **GitHub release and live Foundry test: not yet completed**
