# Character boards — sources

Faction board front/back scans + faction leader/character cards + official Vagabond cards. Pulled from Root Database.

Layout: one subdirectory per faction id (`marquise-de-cat/`, `eyrie-dynasties/`, …) plus `vagabond/`. Catalog root keeps `boards.json` + `SOURCES.md`.

| Source | URL | Used for |
|--------|-----|----------|
| Root Database | https://www.therootdatabase.com | boards + cards |
| Faction pages | https://www.therootdatabase.com/faction/{id}/ | front/back boards |
| Faction decks | https://www.therootdatabase.com/post/{id}/en/decks/ | leaders, viziers, ministers, moods, captains |
| Vagabond pages | https://www.therootdatabase.com/vagabond/{id}/ | character cards |
| Leder Games | https://ledergames.com | publisher / © |

## Coverage

**Faction boards** (front + back): Marquise, Eyrie, Woodland Alliance, Vagabond, Riverfolk Company, Lizard Cult, Underground Duchy, Corvid Conspiracy, Lord of the Hundreds, Keepers in Iron, Lilypad Diaspora, Twilight Council, Knaves of the Deepwood.

**Vagabond characters** (card front): Thief, Tinker, Ranger (base); Arbiter, Scoundrel, Vagrant (Riverfolk); Adventurer, Harrier, Ronin (Vagabond Pack); Cheat, Gladiator, Jailor (Homeland).

**Faction cards** (from `/post/{faction}/en/decks/`):
- Eyrie leaders (Builder, Charismatic, Commander, Despot) + Loyal Viziers ×2
- Underground Duchy ministers ×9
- Lord of the Hundreds moods ×8
- Knaves captain cards ×12

**Not on Root Database** (no deck upload): Keepers retainers, Twilight edicts, Corvid/Marquise/Alliance/Riverfolk/Lizard faction cards. Lilypad frog shared-deck cards omitted (not character/leader cards).

See `boards.json` for LLM-friendly catalog (`factions`, `vagabonds`, `factionCards`). Image paths are `{faction-id}/{filename}.webp`.

© Leder Games. Reference only — not for redistribution beyond fair personal/dev use.
