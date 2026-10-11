## run_012_impending_darkness_event - Prepare and play the Impending Darkness Event
> Status: Draft
> Category: support
> Verified: 2026-10-10, live: Chap cleared it (5 rounds, final Bane ranged after one magic reroll) with an in-page driver; Kang died once in round 4 (Unhallowed Wasteland, S1, flee check at 30% polled every second) and was restarted with the stricter rules below.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.
> Indicators reviewed: 2026-10-11 02:15:44

# Trigger
- A character must clear Impending Darkness (it unlocks The Abyssal Approach).

# Prerequisites
- Read `docs/dungeons/impending-darkness.md` (mechanics, modifier ranking, sets, eating rules).
- Into the Mist cleared, Slayer Skillcape (or Maximum Skillcape) owned, Map to the Unhallowed Wasteland bought.
- 100% Slayer area negation reachable for Unhallowed Wasteland: Slayer gear pieces plus the Pillar of Combat Agility obstacle, or the Cartography point of interest Perilous Peaks at hex (19, 9) with Atlas of Discovery.
- One set per style (S1 melee, S2 ranged, S3 magic) that beats Bane in that style at or under the death threshold. Ranged needs Shockwave, magic does well with Ocean Song and the Dragon + Unicorn (or Fox) synergy.
- `combat-run` does not handle this event yet: the 2026-10-10 run used an in-page driver (modifier pick by the ranking below, area order and set per area, Bane style -> set, Run on a magic final Bane, final-Bane gear plan before round 5's last area, eat/Run thresholds above). It is to be folded into an `event-run` command.

# Lessons from the 2026-10-10 live run (read first)
- **Round modifiers buff the enemies**, not you, and Bane, Instrument of Fear gets every one picked. Simulations of the final fight without them are optimistic.
- **Unhallowed Wasteland is a hard wall below 100% negation.** Its effect heals the enemy (100 - your `flatSlayerAreaEffectNegation`)% of current HP every 2 turns; at 35% Chap could not kill the first monster in 12 minutes. The simulator ignores area effects, so `dungeon-check` showed 0% deaths there. Measure the real value per set: `game.combat.player.modifiers.flatSlayerAreaEffectNegation` after `changeEquipmentSet`.
- Negation sources found: Slayer (Elite) helmet/body 15 each (passive slot counts), Slayer or Maximum Skillcape 25, Cartography POI **Perilous Peaks +20** (POI **Dark Waters is -20**), Explorers Map consumable +20, Hunter's Ring +10, Pillar of Combat +5, Agility **Cliff Climb -20**. Master kits (Elite -> Master, +5 per piece) cost 1M Slayer Coins but need 40 Slayer tasks of a tier; Legendary/Mythical need this event cleared first.
- The game pauses a dungeon before each boss (`game.combat.paused`): call `game.combat.resumeDungeon()`.
- A hidden browser tab stops Melvor's main loop: run each character in its own window (`Target.createTarget` with `newWindow: true`), never two tabs of one window.
- Eat on your own rule: auto-eat fired at 20% and single hits took over 30% of max HP (Wicked Greater Dragon, Cursed Lich). Eat below 75% (`player.eatFood(1, false)`), Run below 35%, poll every 250 ms.
- Death ends the event (all rounds lost) and costs one random equipped item (Kang lost his S1 amulet).

# Procedure
1. Simulate Bane in each style with each style's set; note the weakest style (it will be rerolled).
2. Prepare the four area sets: 100% negation (Unhallowed Wasteland), 40% negation (Dark Waters), full damage (Shrouded Badlands, Perilous Peaks), Bane set per style.
3. Food Whale-class, Diamond Luck Potion IV, Dragon + Minotaur/Centaur/Witch, Whetstone, Jadestone Bolts, Fire Surge or Incinerate.
4. Start the event. At each round start, **pick the highest-ranked modifier offered** (ranking in the dungeon doc). Restart early if the first picks are awful.
5. Clear areas in the order Unhallowed Wasteland, Dark Waters, Shrouded Badlands, Perilous Peaks, with the prayers from the doc.
6. Bane: switch to the set of **his** style and Protect from that style. If his style is your weak one, **Run** (not Stop Event) to reroll it.
7. Watch Affliction: eat after your own attacks; never let a known max hit exceed current HP. Run if put to sleep by Suffocate.
8. After round 5, Bane, Instrument of Fear: same rules, hold eat against Overwhelming Power when Affliction is high.

# Verification
- The four rewards (Shields of Melee/Ranged/Magic Power, Ring of Power) and the lore book in the bank; The Abyssal Approach unlocked.

# Rollback
- Stop Event ends the attempt (progress lost). A death costs one random equipped item (safe death for Hardcore).

# References
- `docs/dungeons/impending-darkness.md`, `run_011_prepare_and_accompany_a_dungeon_run`
