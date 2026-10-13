# Performance report: `3d-map` vs `main`

Scope: `git diff main...HEAD` (85 files, the three.js 3D map), reviewed for loading time and compute cost.

Method: static read of the diff and surrounding files. Nothing was profiled. Triangle counts come from the GLB headers; tree counts are estimated from the placement grid for a landscape view.

Paths are relative to `frontend/react/`.

## Summary

| # | Severity | Area | Location | Issue |
|---|----------|------|----------|-------|
| 1 | High | Compute | `src/game/map3d/daylight.ts:124` | 4096² shadow map redrawn every frame over about 10k unculled trees |
| 2 | High | Loading | `src/game/map3d/mapModels.ts:139` | 8.6MB of GLBs block the first frame of the default map mode |
| 3 | Medium | Compute | `src/game/map3d/campfires.ts:239` | 12 point lights shaded per fragment even when unlit |
| 4 | Medium | Compute | `src/react/map3d/useMapScene.ts:140` | React re-render on every frame the camera moves |
| 5 | Medium | Compute | `public/assets/models/buildings/final/ruin.glb` | 51.6k-triangle ruin, 29-draw-call keep |
| 6 | Medium | Rebuild / memory | `src/react/map3d/useMapScene.ts:116` | Full synchronous scene rebuild on a resize step, GPU resources not disposed |
| 7 | Low | Loading | `public/assets/models/buildings/final/keep.glb` | 2.6MB unused asset shipped |
| 8 | Low | Loading | `src/react/map3d/useMapScene.ts:86` | No model cache across the 2D / 3D toggle |
| 9 | Low | Compute | `src/game/map3d/pieceMeshes.ts:366` | Every piece model re-cloned on each board sync |

## Compute (per frame)

### 1. Shadow map redrawn every frame — High

`src/game/map3d/daylight.ts:124`, `src/game/map3d/mapScene.ts:94`, `src/game/map3d/mapScene.ts:156`

- The sun casts a 4096 x 4096 shadow map and `renderer.shadowMap.autoUpdate` is left at its default, so the shadow pass runs on every frame.
- The render loop never idles: it calls `renderer.render` on every animation frame, although the scene is mostly static.
- The forest is about 10k instanced trees, roughly 1.5 to 2 million triangles, drawn twice per frame (shadow pass and colour pass) at a device pixel ratio of up to 2.
- `InstancedMesh` has no per-instance frustum culling, so zooming into one clearing still draws the whole forest.

Effect: dropped frames and battery drain, worst on phones and the iOS build.

Fix: set `shadowMap.autoUpdate = false` and raise `shadowMap.needsUpdate` only when pieces change or the light is fading; consider a smaller shadow map.

### 3. Campfire point lights always in the scene — Medium

`src/game/map3d/campfires.ts:239`

Each of the 12 clearings owns a `PointLight`. In birdsong and daylight their intensity is 0, but three.js still includes them in the light count, so every lit fragment (ground, trees, pieces) loops over 12 point lights for two of the three phases of a turn.

Fix: set `light.visible = false` while the burn level is near 0. This costs one shader recompile per toggle.

### 4. React re-render per camera frame — Medium

`src/react/map3d/useMapScene.ts:140`

Every OrbitControls `change` event calls `setViewVersion`, which re-renders `BoardMap3D`. This happens on every frame of the 1.4 second opening glide, every pan and zoom, and the damping tail after each gesture.

Each render re-projects the 12 clearings, builds a new `hitCenters` map and a new `stackPositionOf` callback, so `BoardEffectsLayer` and every effect view re-render as well. This shares the main thread with the render loop.

Fix: position the overlays imperatively through refs, or throttle the update.

### 5. Heavy piece models — Medium

`public/assets/models/buildings/final/ruin.glb`, `public/assets/models/buildings/final/keep-rebuilt.glb`

| Model | Triangles | Primitives | Size | Notes |
|-------|-----------|------------|------|-------|
| `ruin.glb` | 51,599 | 6 | 4.4MB | Four 1024² JPEG textures; several ruins stand on the board at the start |
| `keep-rebuilt.glb` | 30,924 | 29 | 1.65MB | 29 draw calls, doubled by the shadow pass |
| `workshop.glb` | 8,009 | 11 | 667KB | |
| Other buildings | 1,100 to 5,100 | 3 to 17 | 60 to 365KB | |
| Meeples | about 1,000 to 1,400 | 2 to 3 | about 100 to 135KB | |

The cost applies only above zoom 0.12; the models are hidden before that.

Fix: decimate the ruin and the keep, and merge the keep's primitives.

### 9. Piece models re-cloned on each board sync — Low

`src/game/map3d/pieceMeshes.ts:366`

`setPieces` clears the group and clones every model again on each board sync. The new hold-back timers for moves and recruits (`src/game/ReactGameController.ts:907`) add more syncs per action. Geometry is shared, so this is a few milliseconds per sync.

Fix, if it shows up in a profile: diff by `piece.key` and reuse unchanged pieces.

## Loading

### 2. All models gate the first frame — High

`src/game/map3d/mapModels.ts:139`, `src/game/hudStore.ts:245`, `src/react/GameScreen.tsx`

- The scene is created only after a single `Promise.all` over 25 GLB files, about 8.6MB in total. The ruin (4.4MB) and the rebuilt keep (1.65MB) are about 70% of that. No Draco or meshopt compression is used.
- 3D is the default map mode, the wallpaper is hidden in 3D, and the `Suspense` fallback is `null`, so the player sees a dark screen until the three.js chunk and every model have arrived and parsed.
- The piece models are not visible at the opening zoom anyway. Only the trees and the campfire, about 160KB, are needed for the first frame.
- Models for factions that are not in the game (lizard, riverfolk, the alternative Vagabond pawns) are loaded regardless.

Fix: build the scene once the trees and the campfire are loaded, and load the piece models afterwards, limited to the factions in play.

### 7. Unused asset shipped — Low

`public/assets/models/buildings/final/keep.glb`

2.6MB, not referenced: `token-marquise-keep` maps to `keep-rebuilt`. It still ships in `dist` and in the iOS bundle.

### 8. No model cache across the 2D / 3D toggle — Low

`src/react/map3d/useMapScene.ts:86`

Each toggle remounts `BoardMap3D`, which calls `loadMapModels` again. The HTTP cache saves the network only: every GLB is parsed again, and a new renderer and a full scene are built.

Fix: cache the `loadMapModels` promise at module level.

## Rebuild and memory

### 6. Full scene rebuild on a resize step, incomplete dispose — Medium

`src/react/map3d/useMapScene.ts:116`, `src/game/map3d/mapScene.ts:212`

When `terrainShape` crosses a step (dragging a window edge, rotating a phone), the whole scene is disposed and rebuilt synchronously on the main thread:

- the ground is repainted on a 4096-pixel-wide canvas;
- `placeTrees` tests about 11k grid cells against about 250 segments each;
- the trees are re-instanced and the models re-cloned;
- the opening camera glide replays.

`dispose` does not release the ground texture (about 50MB with mipmaps), the tree meshes and materials, the shadow map (about 64MB), the ground markers, or the daylight rig. The new renderer is created on the same canvas, so it reuses the same GL context and the old GPU memory stays until garbage collection. Repeated resizes on iOS risk the tab being killed.

Fix: dispose every geometry, material, texture and the sun's shadow map in `dispose`; keep the scene across a terrain change where possible.

## Checked and clean

- three.js is in a lazy chunk (`src/react/GameScreen.tsx`).
- `react-icons` uses deep imports, so it tree-shakes.
- The sightline shader loop breaks at the live target count.
- Particle counts are small (16 to 60 per system).
- `useKeyframes` does not restart an animation on re-render.
