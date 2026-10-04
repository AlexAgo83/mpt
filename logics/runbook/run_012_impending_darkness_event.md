## run_012_impending_darkness_event - Prepare and play the Impending Darkness Event
> Status: Draft
> Category: support
> Verified: (not yet verified). Written 2026-10-04 from the wiki Guide (v1.3.1); Chap and Kang simulated against Bane alone at 60-72% deaths with their current sets.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.

# Trigger
- A character must clear Impending Darkness (it unlocks The Abyssal Approach).

# Prerequisites
- Read `docs/dungeons/impending-darkness.md` (mechanics, modifier ranking, sets, eating rules).
- Into the Mist cleared, Slayer Skillcape (or Maximum Skillcape) owned, Map to the Unhallowed Wasteland bought.
- 100% Slayer area negation reachable for Unhallowed Wasteland: Slayer gear pieces plus the Pillar of Combat Agility obstacle, or the Cartography point of interest Perilous Peaks at hex (19, 9) with Atlas of Discovery.
- One set per style (S1 melee, S2 ranged, S3 magic) that beats Bane in that style at or under the death threshold. Ranged needs Shockwave, magic does well with Ocean Song and the Dragon + Unicorn (or Fox) synergy.
- `combat-run` does not handle this event yet (rounds, modifier choices, Bane rerolls): the run is accompanied by hand until that automation exists.

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
