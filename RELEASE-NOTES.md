# WoD20 Initiative Tool v0.1.2 (Beta)

A compact, system-agnostic initiative safeguard for Foundry VTT v14. It does not modify WoD20's dice roller.

## What it adds

- GM Lock/Unlock for the current encounter so accidental rerolls do not replace existing scores.
- Drag handles to reorder already rolled combatants.
- A saved initiative snapshot and GM Restore action.
- Previous Turn and Next Turn controls at the top of the tracker. Native bottom controls remain.

## Before you install

- **Beta:** 21 automated tests passed; the Foundry v14 live GM/player workflow is **not yet verified**. Test in a disposable world and back up your live world.
- A lock is a standard Foundry client-side guard, not a server security policy. Another module may still show reroll prompts.
- Dragging changes numeric initiative values. Restore saved scores before disabling, or revert to a world backup.

## Install

- Foundry Setup → Add-on Modules → Install Module: paste `https://raw.githubusercontent.com/rebsiot/wod20-initiative-tool/main/module.json` as the manifest URL.
- Alternatively download the ZIP asset, stop Foundry, and extract it so `module.json` is directly in `Data/modules/wod20-initiative-tool/`.
- Enable in a **test world**, then try one encounter with GM and player clients.

For complete usage and rollback guidance, see [README.md](https://github.com/rebsiot/wod20-initiative-tool/blob/main/README.md).
