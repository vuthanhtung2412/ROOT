# 3D map models — sources

Used by the 3D map (`src/game/map3d/mapModels.ts`).

## `nature/` — trees

Kenney **Nature Kit 2.1**, Creative Commons Zero (CC0). Credit is optional;
we credit anyway: Kenney, https://kenney.nl/assets/nature-kit

Files are the unmodified `Models/GLTF format/*.glb` of the kit. The kit's teal
foliage is repainted at load time (`src/game/map3d/treeMeshes.ts`).

## `meeples/` — warriors and Vagabond pawns

Made in Blender for this project: the outline of each warrior token
(`public/assets/tokens/<faction>/warrior.png`, `vagabond/pawn*.png`) is traced
(OpenCV `findContours` on the alpha channel), extruded 0.8 units deep and
bevelled; the token art is mapped onto the front face, the rest takes the
token's body colour. Height 2.3 units, feet on the ground, front towards +Z.
