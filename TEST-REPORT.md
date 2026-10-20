# WoD20 Initiative Tool v0.1.2 — Test Report

**Release candidate:** v0.1.2 beta, 2026-10-19 (not deployed to a Foundry world)  
**Source:** renamed from the locally verified v0.1.1 beta ZIP `stl-initiative-guard-v0.1.1-beta.zip` (all ZIP entries matched the unpacked working source). Repository publication is a separate verification step, not a live Foundry test.  
**Target:** Foundry v14, any game system; no game-system schema dependencies.

## Automated/mock-tested

- `node --check` on all three ES modules: passed.
- `node --test tests/*.test.mjs`: **21 passed, 0 failed** (20 retained behavioral/mock tests + 1 new module-ID/manifest/asset consistency test).
- Initiative score plan: moving above/below, midpoint, tied values (local fractional reflow), no-op, unrolled-restriction.
- Hook simulator: locked normal reroll/clear canceled, GM explicit bypass permitted, player's attempted bypass rejected, first roll permitted, non-initiative edits allowed, parent-Combat bulk initiative changes rejected.
- New turn navigation mocks: GM-only, started combat only, top placement and unchanged native footer, native methods, first-round disabled state, stale encounter check, no duplicate control on rerender, rapid-click prevention and error notification.
- Module ID, title, entry points, CSS class selectors and absence of stale runtime IDs: passed.
- ZIP manifest/entrypoint integrity and JSON parsing: passed.

## Planned/unverified — live Foundry tests required

1. Foundry v14 exact installed build with actual Combat Tracker sidebar and popout; GM sees exactly one Lock/Unlock and each rolled combatant has one grip handle. Start combat and confirm top Previous/Next Turn buttons appear directly above the list; footer controls remain. Test both controls through a round boundary and confirm only one turn advances per click.
2. Player and GM login simultaneously; lock a test combat and reroll/Reset Initiative from each client. All previously rolled scores remain unchanged; confirm no spurious browser-console errors.
3. A late entrant can roll once. On the next attempt its initiative is guarded. Turns/rounds still advance normally.
4. GM drags a participant between others, then through ties. Check ordering, value presentation, chat behavior and preservation of the active combatant mid-round.
5. Snapshot Restore restores original rolled scores without deleting late combatants or changing Actors.
6. Check coexistence with WoD20 `worldofdarkness` exact installed version, Combat Workflow, and any modules that modify the Combat Tracker (especially Monk's Combat Details).

## Important risk

Foundry's pre-update hooks are fired on the **initiating client**. This add-on is a guardrail for ordinary in-app actions on enabled clients, not a server-side enforcement mechanism. An external module may still *open* unwanted roll prompts or produce roll chat messages even if the initiative document update is canceled.

**Confirmed live:** None. No server/client session was accessed.  
**Deployment:** Not performed; installation requires the user's action.  
**Rollback:** Disable the module; restore saved scores first, or recover the world snapshot for earlier Combatant initiative values. See README.
