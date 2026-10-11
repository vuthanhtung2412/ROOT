# 3D map models — sources

Used by the 3D map (`src/game/map3d/mapModels.ts`).

## `nature/` — trees

Kenney **Nature Kit 2.1**, Creative Commons Zero (CC0). Credit is optional;
we credit anyway: Kenney, https://kenney.nl/assets/nature-kit

Files are the unmodified `Models/GLTF format/*.glb` of the kit. The kit's teal
foliage is repainted at load time (`src/game/map3d/treeMeshes.ts`).

## `buildings/` — structures standing for buildings and tokens

Unmodified files, renamed after the piece they stand for (mapping in
`src/game/map3d/mapModels.ts`).

`quaternius/` — by **Quaternius** (https://quaternius.com), Creative Commons
Zero (CC0 1.0), downloaded from Poly Pizza:

| File | Model | Page |
|------|-------|------|
| `quaternius/sawmill.glb` | Fantasy Sawmill | https://poly.pizza/m/alxTTFjKDM |
| `quaternius/workshop.glb` | Blacksmith | https://poly.pizza/m/bV52eTG1Aj |
| `quaternius/recruiter.glb` | Fantasy Barracks | https://poly.pizza/m/wTDbVozPAj |
| `quaternius/keep.glb` | Tower | https://poly.pizza/m/iuMDwgTRMU |
| `quaternius/wood.glb` | Logs | https://poly.pizza/m/fei4I7FfrJ |
| `quaternius/roost.glb` | Bell Tower | https://poly.pizza/m/ux44tbeQvj |
| `quaternius/base.glb` | Tent | https://poly.pizza/m/5Q7qIrfDxA |
| `quaternius/garden.glb` | Temple | https://poly.pizza/m/JsZnPztvRl |
| `quaternius/trade-post.glb` | Market Stalls | https://poly.pizza/m/jSqGy8V0MQ |

`nature/ruin.glb` — Kenney Nature Kit 2.1 (CC0), `stone_tallB.glb`.

## Git

`*.glb` is ignored by the repository's `.gitignore`, so the model files of
this directory live on disk only. Fetch them again from the pages above (and
the kit for `nature/`), or re-export the meeples, on a fresh checkout.

## `meeples/` — warriors and Vagabond pawns

Made in Blender for this project: the outline of each warrior token
(`public/assets/tokens/<faction>/warrior.png`, `vagabond/pawn*.png`) is traced
(OpenCV `findContours` on the alpha channel), extruded 0.8 units deep and
bevelled; the token art is mapped onto the front face, the rest takes the
token's body colour. Height 2.3 units, feet on the ground, front towards +Z.
