## run_012_impending_darkness_event - Prepare and play the Impending Darkness Event
> Status: Draft
> Category: support
> Verified: 2026-10-10, live: Chap cleared it (5 rounds, final Bane ranged after one magic reroll) with an in-page driver; Kang died once in round 4 (Unhallowed Wasteland, S1, flee check at 30% polled every second) and was restarted with the stricter rules below. `event-run` is that driver as a command: not run live yet as a command.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-10-11 10:09:50

# Trigger
- A character must clear Impending Darkness (it unlocks The Abyssal Approach).

# Prerequisites
- Read `docs/dungeons/impending-darkness.md` (mechanics, modifier ranking, sets, eating rules).
- Into the Mist cleared, Slayer Skillcape (or Maximum Skillcape) owned, Map to the Unhallowed Wasteland bought.
- 100% Slayer area negation reachable for Unhallowed Wasteland: Slayer gear pieces plus the Pillar of Combat Agility obstacle, or the Cartography point of interest Perilous Peaks at hex (19, 9) with Atlas of Discovery.
- One set per style (S1 melee, S2 ranged, S3 magic) that beats Bane in that style at or under the death threshold. Ranged needs Shockwave, magic does well with Ocean Song and the Dragon + Unicorn (or Fox) synergy.
- `dungeon-check <char> "Impending Darkness Event"` shows `ok` on every line, including `S3 negates 100% of Slayer area effects`.

# Lessons from the 2026-10-10 live run (read first)
- **Round modifiers buff the enemies**, not you, and Bane, Instrument of Fear gets every one picked. Simulations of the final fight without them are optimistic.
- **Unhallowed Wasteland is a hard wall below 100% negation.** Its effect heals the enemy (100 - your `flatSlayerAreaEffectNegation`)% of current HP every 2 turns; at 35% Chap could not kill the first monster in 12 minutes. The simulator ignores area effects, so `dungeon-check` showed 0% deaths there. Measure the real value per set: `game.combat.player.modifiers.flatSlayerAreaEffectNegation` after `changeEquipmentSet`.
- Negation sources found: Slayer (Elite) helmet/body 15 each (passive slot counts), Slayer or Maximum Skillcape 25, Cartography POI **Perilous Peaks +20** (POI **Dark Waters is -20**), Explorers Map consumable +20, Hunter's Ring +10, Pillar of Combat +5, Agility **Cliff Climb -20**. Master kits (Elite -> Master, +5 per piece) cost 1M Slayer Coins but need 40 Slayer tasks of a tier; Legendary/Mythical need this event cleared first.
- The game pauses a dungeon before each boss (`game.combat.paused`): call `game.combat.resumeDungeon()`.
- A hidden browser tab stops Melvor's main loop: run each character in its own window (`Target.createTarget` with `newWindow: true`), never two tabs of one window.
- Eat on your own rule: auto-eat fired at 20% and single hits took over 30% of max HP (Wicked Greater Dragon, Cursed Lich). Eat below 75% (`player.eatFood(1, false)`), Run below 35%, poll every 250 ms.
- Death ends the event (all rounds lost) and costs one random equipped item (Kang lost his S1 amulet).

# Procedure
1. `dungeon-check <char> "Impending Darkness Event"`: fix every `NO` line first (negation: see the sources above, then re-check).
2. `dungeon-optimize <char> "Impending Darkness Event" --style melee`, then `--style ranged` (one style per call): the final-Bane plans `event-run` puts on before the last area. Magic is not needed: a magic final Bane is rerolled.
3. `event-run <char>`: starts the event and plays it to the end with the rules above (modifier ranking, areas Unhallowed Wasteland S3, Dark Waters S2, Shrouded Badlands and Perilous Peaks S1, Bane in his style's set, resume before each boss, eat under 75%, Run under 35% then eat back to 95% and go on, Run from a magic final Bane). It refuses to start under 100% negation, stops on an offer it does not recognise, after 3 Runs, 10 rerolls or 2 hours (`MELVOR_EVENT_RUN_TIMEOUT_MS`), puts the final-Bane plan gear back and saves. Exit code 1 unless cleared.
4. `slayer-start <char>`: the event leaves the character idle.
5. One character at a time: the mpt lock allows one session, and a hidden tab stops the game loop.
6. By hand only if `event-run` stopped: the rules in `docs/dungeons/impending-darkness.md` (eat after your own attacks under Affliction, Run if put to sleep by Suffocate).

# Verification
- `event-run` prints `cleared` and `clears N -> N+1`; `dungeon-check` shows the new clear count.
- The four rewards (Shields of Melee/Ranged/Magic Power, Ring of Power) and the lore book in the bank; The Abyssal Approach unlocked.

# Rollback
- Stop Event ends the attempt (progress lost). A death costs one random equipped item (safe death for Hardcore).

# References
- `docs/dungeons/impending-darkness.md`, `run_011_prepare_and_accompany_a_dungeon_run`
