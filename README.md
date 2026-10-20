# WoD20 Initiative Tool (Beta) v0.1.2

A small **system-agnostic Foundry v14** Combat Tracker add-on. It does not depend on WoD20 or replace Foundry's initiative dice.

## What it does

- Adds **Previous Turn / Next Turn** buttons above the combatant list for the GM during a started encounter. These call Foundry's native turn-navigation methods; **the original bottom controls remain**.
- Adds **Lock Initiative / Unlock Initiative** to the GM Combat Tracker. Lock is **per encounter** and persists across reloads.
- While locked, prevents existing combatants' initiative from being changed/cleared by ordinary Foundry update workflows (including rerolls and bulk resets). Unrolled/new combatants may still receive their first roll.
- Adds a **grip handle** for GMs to drag a rolled combatant above or below another rolled combatant. Works while locked. Players cannot drag.
- Saves a score snapshot whenever the GM locks an encounter. **Restore** (GM only) restores that saved initiative for the combatants that still exist in that encounter; it leaves newly added and previously unrolled combatants unchanged.
- Leaves Actor data, rolls, other combatant properties, and rounds alone.

## Installation

1. Back up your world (and any existing installation of this module ID, if present). This is a **beta**: test it in a disposable test world before your campaign.
2. For installation through Foundry Setup, use the [module manifest](https://raw.githubusercontent.com/rebsiot/wod20-initiative-tool/main/module.json). For manual installation, stop Foundry and extract the complete ZIP to `Data/modules/wod20-initiative-tool/`, so that `module.json` is directly in that folder. On the St. Louis server that is `Z:\Data\modules\wod20-initiative-tool\` via Samba.
3. Restart Foundry; enable **WoD20 Initiative Tool (Beta)** under **Manage Modules** for a **test world**.
4. Open the Combat Tracker as a GM in a **test world**. Start a test encounter, confirm **Previous Turn** and **Next Turn** appear above the combatants, and use them to advance and rewind. Confirm the original bottom controls still work.
5. Roll initiatives; click **Lock Initiative**. Try a player's normal reroll and reset, then drag the grip handle. Test using a separate player client.

## Known limitations

- **Beta, not live-tested.** Foundry v14 is the target based on public API documentation. The top turn controls invoke `Combat.previousTurn()` and `Combat.nextTurn()` directly, but actual sidebar/popout positioning, WoD20 coexistence and player-client interception must be verified in the installed build.
- This is a **client-side guard**, not a server-enforced permission/security rule. It intercepts standard document updates where the enabled client initiates them, not arbitrary direct external database modifications or other privileged/server-side operations.
- Locking does **not** stop a different module from opening a gratuitous reroll *prompt*. It blocks initiative score writes. Disable any automatic reroll-on-round setting separately.
- Dragging changes numeric Combatant initiative values (usually just the moved combatant). When squeezing between tied values, it may add small fractions to that tied group. Original rolled values are preserved in the saved snapshot; this is not a purely cosmetic sort.
- Drag is currently mouse-based (no keyboard reordering or touch support). Combatants must have rolled first to be draggable.
- If a participant's active turn is moved mid-round, the add-on attempts to maintain the same active combatant. This needs a live regression test with timed effects/other combat modules.
- Native Combat Tracker markup can vary with other modules; the top buttons and drag handles require a compatible combatant-list element. Do not combine with other tracker replacements without a separate live compatibility check.
- **Turn buttons** are GM-only and do not appear before combat starts. They do not add top round-switching controls; the native controls at the bottom continue to handle round navigation.

## Identity change from the earlier beta

This is a **new Foundry module ID**, not an in-place version upgrade of `stl-initiative-guard`. The older v0.1.1 beta was not installed in the intended campaign, so no in-world migration is needed there. If you installed the old beta elsewhere, do **not** enable both modules together. Make a world backup, disable the old beta, enable this build in a test world, and verify that any old combat locks/snapshots are not automatically carried over. Either manually restore the old encounter state or retain a world backup before removing the old folder. There is no automatic migration of old flags.

**Repository:** https://github.com/rebsiot/wod20-initiative-tool. **Installable ZIP:** https://github.com/rebsiot/wod20-initiative-tool/releases/download/v0.1.2/wod20-initiative-tool-v0.1.2-beta.zip. Although its name says WoD20, this module uses native Foundry Combat/Combatant APIs and has no required game-system dependency.

## Rollback

Disable this module. Revert the module folder from backup if necessary. The module stores `flags.wod20-initiative-tool` on the Combat document, containing two keys (`locked` and `snapshot`). The GM may also change Combatant initiative numbers through dragging and Restore. Disabling removes the guard without reverting prior drag changes. To revert scores, use **Restore** *before disabling*, or your world snapshot. **Uninstalling the ZIP does not roll back world document changes.**

## Evidence

- Automated: Node syntax, pure-ordering tests, mock guard tests, top-navigation mock tests and ZIP validation (see `TEST-REPORT.md`).
- Live: **Not run**. No claim of successful install, player sync, or Foundry v14 compatibility in the actual world.
- Source: new independently authored beta module, not a fork. Repository source is published at the GitHub URL above.

## Licensing

This public repository does not yet declare an open-source license. Public visibility does not by itself grant permission to redistribute modified versions. The maintainer can choose a license before a broader public release.
