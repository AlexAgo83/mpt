# Impending Darkness Event

Final dungeon of the base game. Source: the official wiki,
[Impending Darkness Event](https://wiki.melvoridle.com/w/Impending_Darkness_Event) and its
[Guide](https://wiki.melvoridle.com/w/Impending_Darkness_Event/Guide) (community guide written for v1.3.1).
This page summarizes what an assistant needs to decide; read the guide (`./melvor-report.js dungeon-guide
"Impending Darkness Event"`) for the full gear tables.

## What it really is

It is an **event**, not a normal monster list. The game data shows only Bane, but the event is:

- **5 rounds.** Each round clears 4 Slayer areas: Unhallowed Wasteland, Dark Waters, Shrouded Badlands and
  Perilous Peaks. Each area is a gauntlet of 5 to 8 random monsters from that area; the last one is a
  **Mist Boss** (+20% max HP, damage reduction, accuracy and evasion, -20% attack interval).
- **Bane** at the end of rounds 1 to 4, **Bane, Instrument of Fear** after round 5 (more HP, an extra special
  attack, and every negative modifier picked during the event).
- Starting the event blocks every other fight until it ends. Leaving combat pauses it (progress is kept).
  Only death or "Stop Event" ends it. Death costs one random equipped item; for Hardcore it is a safe death.

## Hard requirements

- **Slayer Skillcape** (or Maximum Skillcape) worn the whole time: every area needs it. Taking it off mid-fight
  makes every attack miss. Effective Slayer requirement: 95.
- **Map to the Unhallowed Wasteland** bought in the shop.
- **100% Slayer area effect negation** for Unhallowed Wasteland (Slayer helmet/gear pieces plus the
  *Pillar of Combat* Agility obstacle, or with Atlas of Discovery the Cartography point of interest
  **Perilous Peaks at hex (19, 9)** for 20% negation).

## Mechanics that drive decisions

- **Affliction.** Standard enemies get *Controlled Affliction*: +500 max HP and a 30% chance to apply
  Affliction, growing by +500 HP and +5% after each Bane. Each stack removes 1% max HP (down to 50%),
  which also lowers the auto-eat threshold. Stacks clear when the monster dies or you leave combat.
- **Bane's style is random** each time and he is **immune to every other style**: fight him with the same
  style. If the matching set is weak, **flee** (the orange Run, not Stop Event): you redo the last area and
  his style is rolled again.
- **A modifier choice at the start of each round** (applies to all enemies for the rest of the event).

## Choices: round modifier, best first

1. +100% chance to ignore stuns and freezes, immune to sleep
2. +20% max hit and -10% max HP
3. +20% max hit and +20% accuracy
4. +2000 max HP and -10% max hit
5. +50% chance to poison and +10% max HP
6. +15% damage reduction and +15% evasion
7. +50% chance to burn and +50% chance to frostburn
8. +100% chance to ignore slow and -5% attack interval
9. Slayer area effects 5% stronger (then wear a Hunter's Ring in the passive slot)
10. +10% max hit, -10% attack interval, -10% evasion
11. +15% chance to apply affliction and +15% lifesteal
12. Heal 4% of current HP every 2 turns and +40% of max hit added to min hit

Pick the highest-ranked option offered. If the offers or the stack of picks are awful, the guide suggests
stopping and restarting the event early for better rolls.

## Order and sets

Clear **Unhallowed Wasteland, Dark Waters, Shrouded Badlands, Perilous Peaks** (never Unhallowed Wasteland or
Dark Waters last: Bane is then fought in Perilous Peaks, where Protect prayers cap his hit chance at 20%).

| Phase | Set | Prayers |
|---|---|---|
| Unhallowed Wasteland | 100% Slayer negation set, swap per combat triangle | Battleheart (Battleborn) + Protect from the enemy's style |
| Dark Waters | 40% negation set (as much damage as possible) | Battleheart + Piety/Rigour/Augury; Protect from Ranged vs Rokken |
| Shrouded Badlands, Perilous Peaks | Slayer Skillcape is enough, full damage | Battleheart + the style's damage prayer |
| Bane | 0% negation set in **Bane's style** | Protect from Bane's style (swap to the damage prayer when he is not casting Fragile Mind) |

Consumables: Whale-class food (one bite heals most of your HP), Diamond Luck Potion IV (Damage Reduction
Potion IV with Agility or for Bane-only fights), Dragon + Minotaur/Centaur/Witch familiars (Fox + Dragon with
Throne of the Herald), Whetstone and Jadestone Bolts, Fire Surge (Incinerate with Dragon + Unicorn synergy).
Protect Item is deliberately not recommended. Equip the Shields of Power and the Ring of Power as soon as owned.

## Eating rules (what the copilot watches)

- Know the auto-eat threshold at 90/80/70/60/50% max HP (Affliction) against each boss attack's max hit.
- Eat right after one of your own attacks; never let a known max hit exceed current HP.
- Bane: *Suffocate*: eat after each attack and around 60% HP, run if put to sleep. *Fragile Mind*: eat before
  the next hit if low. *Overwhelming Power* (final Bane): hold eat if it can exceed the threshold.
- Rokken (Dark Waters) and the Mist Boss Rokken are the most dangerous regular enemies.

## Readiness checklist (what `dungeon-check` must answer)

- [ ] Into the Mist cleared, Slayer Skillcape owned, Map to the Unhallowed Wasteland bought
- [ ] 100% negation reachable for Unhallowed Wasteland (gear + Pillar of Combat or the Perilous Peaks POI)
- [ ] One set per style (melee, ranged, magic) able to beat Bane, simulated in his style
- [ ] Each area's Mist Boss simulated at or under the death threshold with Affliction
- [ ] Food, potion, familiars and ammo enough for 5 rounds
