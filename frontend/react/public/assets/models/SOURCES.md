# 3D map models — sources

Used by the 3D map (`src/game/map3d/mapModels.ts`).

## `nature/` — trees

Kenney **Nature Kit 2.1**, Creative Commons Zero (CC0). Credit is optional;
we credit anyway: Kenney, https://kenney.nl/assets/nature-kit

Files are the unmodified `Models/GLTF format/*.glb` of the kit. The kit's teal
foliage is repainted at load time (`src/game/map3d/treeMeshes.ts`).

## `buildings/final/` — structures standing for buildings and tokens

Exported from the project's Blender file (`root-map-models.blend`, kept outside
the repository), already recoloured for the faction that owns each piece.
Mapping to pieces: `src/game/map3d/mapModels.ts`.

Every piece is exported at its size next to the others, so the game applies
one scale to all (`MODEL_WORLD_SCALE` in `src/game/map3d/pieceMeshes.ts`).
Sizes are the longest side of the model, in metres of the Blender file:

| Size | Longest side | Pieces |
|------|--------------|--------|
| XL | 6 | keep |
| L+ | 4.2 | roost |
| L | 3.6 | base, garden |
| M | 3 | ruin, trade post |
| M− | 2.6 | recruiter, sawmill, workshop |
| S | 2 | sympathy |
| XS | 0.75 | wood, warriors and pawns, sword |

| File | Piece | Made from | Licence |
|------|-------|-----------|---------|
| `keep-rebuilt.glb` | Marquise keep | "Low poly medieval castle" by assetfactory — https://sketchfab.com/3d-models/low-poly-medieval-castle-6f50a7d5c61045bd8e64cd80d4eef84d — reds, spires and battlements recoloured orange; rebuilt as 29 named parts, entry hall shortened, barbican replaced by a gate between the gate towers, bases brought down to one ground plane | **Sketchfab Standard**: usable in the game, the model file itself must not be redistributed |
| `recruiter.glb` | Marquise recruiter | "Stylised Medieval Buildings - Barracks" by Cleo Renshaw — https://sketchfab.com/3d-models/stylised-medieval-buildings-barracks-b08bda65efee488bab07c86d292323f3 — banner and thatch recoloured orange | **CC-BY-4.0**: credit required (line below) |
| `workshop.glb` | Marquise workshop | Quaternius "Blacksmith" (https://poly.pizza/m/bV52eTG1Aj) with Kenney Survival Kit anvil and hammer; roof recoloured orange | CC0 |
| `base.glb` | Woodland Alliance base | Quaternius "Barracks" (https://poly.pizza/m/puD1kbV4kf); banners, flags and hall roof recoloured green | CC0 |
| `trade-post.glb` | Riverfolk trade post | Quaternius "Market Stalls" (https://poly.pizza/m/jSqGy8V0MQ); awnings recoloured teal | CC0 |
| `ruin.glb` | Ruin | "Old fortress" by indigo5367 — https://sketchfab.com/3d-models/old-fortress-aaa7473cc4274e17b2271d179dcea063 — both walls shortened, textures at 1024 px | **CC-BY-4.0**: credit required (line below) |
| `sawmill.glb` | Marquise sawmill | modelled for this project (round hut, great saw, steam boiler) | own work |
| `roost.glb` | Eyrie roost | modelled for this project (leaning tree, platform, blue canopy, lanterns) | own work |
| `garden.glb` | Lizard Cult garden | modelled for this project (pyramids, palms, a sphinx with the lizard meeple's head; no ground slab) | own work |
| `wood.glb` | Marquise wood | modelled for this project (stack of short logs) | own work |
| `sympathy.glb` | Woodland Alliance sympathy | modelled for this project (a crowd of fox, rabbit and mouse meeples with swords under a green banner bearing the sympathy fist) | own work |

Not in the game yet, kept in `resources/reference/models/tokens/`:
`claude-cat-keep.glb`, a keep modelled for this project (own work): curtain wall,
four round towers, gatehouse with drawbridge, and a great tower with the ears,
eyes and whiskers of a cat; brick, shingle and plank textures drawn by script.

Required credit for the recruiter:

> This work is based on "Stylised Medieval Buildings - Barracks"
> (https://sketchfab.com/3d-models/stylised-medieval-buildings-barracks-b08bda65efee488bab07c86d292323f3)
> by Cleo Renshaw (https://sketchfab.com/cleorenshaw) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/)

Required credit for the ruin:

> This work is based on "Old fortress"
> (https://sketchfab.com/3d-models/old-fortress-aaa7473cc4274e17b2271d179dcea063)
> by indigo5367 (https://sketchfab.com/indigo5367) licensed under CC-BY-4.0
> (http://creativecommons.org/licenses/by/4.0/)

## Git

`*.glb` is ignored by the repository's `.gitignore`, so the model files of
this directory live on disk only. The buildings and meeples are kept, one file
per piece, in `resources/reference/models/` with Git LFS, sorted by kind of
piece: `buildings/`, `tokens/` (keep, wood, sympathy, trade post), `markers/`
(ruin), `meeples/` and `items/`. Copy them from there on a fresh checkout:
buildings, tokens and markers all go to `buildings/final/` (`sympathy.glb`,
`keep-rebuilt.glb` and `ruin.glb` are links to their reference files; `keep.glb`, the castle
before it was rebuilt, stays in `tokens/` and is not in the game). The `nature/` trees come
from the kit above.

## `meeples/` — warriors and Vagabond pawns

Made in Blender for this project: the outline of each warrior token
(`public/assets/tokens/<faction>/warrior.png`, `vagabond/pawn*.png`) is traced
(OpenCV `findContours` on the alpha channel), extruded 0.8 units deep and
bevelled; the token art is mapped onto the front face, the rest takes the
token's body colour. Feet on the ground, front towards +Z.

`fox-warrior`, `rabbit-warrior` and `mouse-warrior` (reference only: they
stand in the sympathy crowd) are made the same way from art drawn for this
project, in the colour of their suit. `items/sword.glb` is the sword they
carry, modelled after the sword item.
