## run_013_into_the_mist - Prepare and play Into the Mist
> Status: Active
> Category: support
> Verified: 2026-11-12, static code and git-history review: mh.dungeonCheck checks Dungeon Equipment Swapping and simulates the dungeon fights; the manual phase procedure matches docs/dungeons/into-the-mist.md (863803c). No live game run or phase automation verified.
> Related request: (none yet)
> Related backlog: (none yet)
> Related task: (none yet)
> Reminder: Update status, category, verification, and linked refs when you edit this doc.

# Trigger
- A character has not cleared Into the Mist (it unlocks the passive slot, Dark Waters and, with 5 clears, Stronghold of the Gods), or the operator farms the 5 clears.

# Prerequisites
- Read `docs/dungeons/into-the-mist.md`.
- Dungeon Equipment Swapping bought (mandatory to swap sets between boss phases).
- Sets S1 melee, S2 ranged, S3 magic each able to beat its boss phase at or under the death threshold.

# Procedure
1. Simulate each phase in its style (melee phase 1, ranged phase 2, magic phase 3) with the matching set.
2. Waves 1-20: best magic set, or swap per combat triangle.
3. Before each boss phase (combat pauses): switch to the phase's set and prayers (Protect from Melee for phase 1; Battleheart + Rigour for phase 2), then start the phase.
4. Phase 1 is the hardest: fast 1h weapon to drop Mark of Death; do not manually eat under Mark of Death when idling.
5. Eat by the rules in the doc; run if a max hit can exceed current HP.

# Verification
- Operator cleanup 2026-11-12: retained as Active as a manual procedure, checked against mh.dungeonCheck and the tracked dungeon guide. This review did not verify live game mechanics; combatRunScript does not automate the phase switches or boss pauses.
- Lore books Beginning of the End and New Dawn in the bank; passive slot usable.

# Rollback
- Leaving combat ends the attempt. A death costs one random equipped item.

# References
- `docs/dungeons/into-the-mist.md`, `run_011_prepare_and_accompany_a_dungeon_run`
