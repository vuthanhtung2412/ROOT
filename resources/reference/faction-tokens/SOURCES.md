# Faction tokens — sources

Clean piece PNGs from Decimator85’s **Root Assets** pack (TTS-extracted), via Root Database workshop.

| Source | URL | Used for |
|--------|-----|----------|
| Root Database → Root Assets | https://www.therootdatabase.com/resources/53/ | catalog |
| Google Drive (Assets) | https://drive.google.com/drive/folders/1M2tB_F63TUOTKVqZ2o3631SSYOJXQ1Lq | PNGs |
| Factions / Marquise de Cat | Drive subfolder | cat pieces |
| Factions / Eyrie Dynasties | Drive subfolder | eyrie pieces |
| Factions / Woodland Alliance | Drive subfolder | alliance pieces |

## Inventory (base game)

### Marquise de Cat (`marquise/`)

| File | Source name | Kind |
|------|-------------|------|
| `warrior.png` | `Meeple.png` | warrior |
| `sawmill.png` | `Sawmill.png` | building |
| `workshop.png` | `Workshop.png` | building |
| `recruiter.png` | `Recruiting Station.png` | building |
| `wood.png` | `Wood.png` | token |
| `keep.png` | `Keep.png` | token |

### Eyrie Dynasties (`eyrie/`)

| File | Source name | Kind |
|------|-------------|------|
| `warrior.png` | `Meeple.png` | warrior |
| `roost.png` | `Roost.png` | building |

### Woodland Alliance (`woodland/`)

| File | Source name | Kind |
|------|-------------|------|
| `warrior.png` | `Meeple.png` | warrior |
| `sympathy.png` | `Sympathy.png` | token |
| `base-fox.png` | `Base - Fox.png` | building |
| `base-rabbit.png` | `Base - Rabbit.png` | building |
| `base-mouse.png` | `Base - Mouse.png` | building |

Maps to `lib/src/pieces/types.ts`:
- `BuildingType`: `sawmill` | `workshop` | `recruiter` | `roost` | `base`
- `TokenType`: `wood` | `keep` | `sympathy`

Same Drive pack also has Items, Suits, Maps, other factions (Corvid plots, Duchy markets, etc.) if needed later.

© Leder Games. Reference only — not for redistribution beyond fair personal/dev use.
