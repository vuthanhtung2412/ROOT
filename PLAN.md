### Goal
- Ship 3D map only. No toggle. No flat painted board path.
- Delete 2D-only UI, helpers, and assets that nothing imports after the cut.
- Leave `record-3d-map.mjs` alone (user: not important).

### Approach
1. Relocate shared props out of `BoardMap.tsx` so 3D does not depend on dead file.
2. Wire `GameScreen.tsx` to always mount `BoardMap3D`; drop toggle, wallpaper, flat host wrappers; eager import OK.
3. Drop `MapViewMode` / `mapViewMode` from `hudStore.ts` (incl. `resetHud` preserve).
4. Delete flat UI + pixel layout modules; slim leftover helpers; remove autumn/wallpaper from asset catalog + disk.
5. Do **not** touch `resources/reference/map/base/autumn-map.jpg` or `lib` fall layout SoT.

### Test plan
- Frontend unit: `gameAssets`, `forestLayout`, `clearingIndicators`, `boardMapLayout` gone → suite green.
- Backend: `static.test.ts` green.
- Manual: open game → 3D map only, no toggle; clearings/forests clickable; effects still overlay.

### Commit plan
- `refactor(map): extract GameMapProps type`
  - `frontend/react/src/game/gameMapProps.ts` (new)
  - `frontend/react/src/react/BoardMap.tsx` (re-export / import type)
  - `frontend/react/src/react/map3d/BoardMap3D.tsx`
- `feat(map): ship 3D map only`
  - `frontend/react/src/react/GameScreen.tsx`
  - `frontend/react/src/game/hudStore.ts`
- `chore(map): delete flat BoardMap UI`
  - delete `BoardMap.tsx`, `ForestPawnLayer.tsx`, `ClearingFlashMark.tsx`, `boardMapLayout.ts`, `boardMapLayout.test.ts`
- `chore(map): drop flat-only helpers`
  - `forestLayout.ts`, `PieceStack.tsx`, `clearingIndicators.ts` + test
- `chore(map): remove painted map assets`
  - `gameAssets.ts` + `gameAssets.test.ts`
  - delete `autumn-map.webp`, `ks-pooneac-root.jpg`
  - `backend/web/src/static.test.ts`
