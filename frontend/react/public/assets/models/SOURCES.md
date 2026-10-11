# 3D map models — sources

Used by the 3D map (`src/game/map3d/mapModels.ts`).

## `nature/` — trees

Kenney **Nature Kit 2.1**, Creative Commons Zero (CC0). Credit is optional;
we credit anyway: Kenney, https://kenney.nl/assets/nature-kit

Files are the unmodified `Models/GLTF format/*.glb` of the kit. The kit's teal
foliage is repainted at load time (`src/game/map3d/treeMeshes.ts`).

## `buildings/` — structures standing for buildings and tokens

All Kenney, Creative Commons Zero (CC0), unmodified files renamed after the
piece they stand for (mapping in `src/game/map3d/mapModels.ts`):

| File | Kit | Original |
|------|-----|----------|
| `town/sawmill.glb` | Fantasy Town Kit 2.0 — https://kenney.nl/assets/fantasy-town-kit | `watermill.glb` |
| `town/trade-post.glb` | Fantasy Town Kit 2.0 | `stall-red.glb` |
| `town/garden.glb` | Fantasy Town Kit 2.0 | `fountain-round.glb` |
| `hexagon/workshop.glb` | Hexagon Kit 2.0 — https://kenney.nl/assets/hexagon-kit | `unit-house.glb` |
| `hexagon/roost.glb` | Hexagon Kit 2.0 | `unit-tower.glb` |
| `hexagon/base.glb` | Hexagon Kit 2.0 | `unit-mansion.glb` |
| `hexagon/keep.glb` | Hexagon Kit 2.0 | `unit-wall-tower.glb` |
| `nature/recruiter.glb` | Nature Kit 2.1 | `tent_detailedOpen.glb` |
| `nature/wood.glb` | Nature Kit 2.1 | `log_stack.glb` |
| `nature/ruin.glb` | Nature Kit 2.1 | `stone_tallB.glb` |

`town/Textures/colormap.png` and `hexagon/Textures/colormap.png` are the
colour maps the models of each kit point at.

## `meeples/` — warriors and Vagabond pawns

Made in Blender for this project: the outline of each warrior token
(`public/assets/tokens/<faction>/warrior.png`, `vagabond/pawn*.png`) is traced
(OpenCV `findContours` on the alpha channel), extruded 0.8 units deep and
bevelled; the token art is mapped onto the front face, the rest takes the
token's body colour. Height 2.3 units, feet on the ground, front towards +Z.
