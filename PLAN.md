### Goal

Original asks (verbatim intent):

1. **check disappearance from crafted card usage** (e.g. false order)
2. **check if react actually make letter more clear and beneficial for the code base overall** (`phaser-template-react`)
3. **check crafted items limit**
4. **crafted items display on the crafted items track**
5. **Improve UX for picking a count of same-type things** — shared stepper `< N x {label} >` for move **and** battle removal (warriors **and** buildings/tokens), respecting Law 4.3.4

Ship: exact-hit eng fix → item icons on crafted track → shared count stepper → battle removal composer (warrior-first, same stepper for buildings/tokens). Checks 1–3 stay findings.

### Approach

**1. Disappearance from crafted card usage (e.g. False Orders)** — *check*
- Engine OK: False Orders / Saboteurs discard self from `playArea` → deck on use.
- UX gap (later): Phaser has no `falseOrders` composer → `Unsupported action falseOrders`.

**2. React letter clarity / codebase benefit** — *check*
- **Verdict: no migrate for this slice.** Stay pure Phaser for board/modals now.

**3. Check crafted items limit** — *check*
- Craft gated by `ITEM_SUPPLY`. Marquise/Eyrie Crafted Items box: **no capacity cap**. Vagabond GP4 — out of scope.

**4. Crafted items display on crafted items track** — *implement*
- Icons in `public/assets/items/` → register → view model `{ type, exhausted }` → icon row (dim exhausted).

**4b. Law 4.3.4 warriors-before-buildings — *check (order OK)***
- SoT 4.3.4: all warriors in clearing before any buildings/tokens.
- Engine: `isValidRemoval` + `legalRemovalSpecs` + test `Rule: Battle 4 — victim removes warriors before buildings`.

**4c. Exact hit count — *fix eng first***
- Was only listed as optional before; **now in commit plan as first battle-related commit.**
- Gap: `isValidRemoval` allows `pieceIds.length < maxHits` (under-remove). Law 1.4 + 4.3.4 → remove exactly `R = min(hits, pieces in clearing)`.
- Fix: require `pieceIds.length === min(maxHits, victimPieces.length)`; slim `legalRemovalSpecs` to exact-size legal combos only; tests.

**5. Shared stepper UX** — *implement*

Control: `< N x {label} >` (◀ / ▶). Same widget for move warrior count **and** battle removal of warriors **and** buildings/tokens. No map piece-click for removal. No side-by-side tray combos for counts.

**Move (March / decree)**
- Contiguous `1..N` warrior counts → stepper; Confirm submits `N`.

**Battle removal** (after exact-hit eng; Law 4.3.4 order):

Given hits `H`, warriors `W`, buildings/tokens `B`, `R = min(H, W+B)`:

| Case | Flow |
|------|------|
| `R ≤ W` | Stepper locked or single value: `< R x warriors >` → Confirm. Submit any `R` warrior ids. |
| `R > W` | Phase 1: auto include all `W` warriors (show locked `< W x warriors >`). Phase 2: remaining `K = R−W` buildings/tokens via **same stepper** — see below. |
| `W = 0` | Only building/token stepper for exact `R` pieces. |

**Building/token stepper (same UX, not map pick):**
- Group victim buildings/tokens by `kind`+`type` (e.g. sawmill, workshop, wood, roost).
- **One type only (or all remaining same label):** `< N x {type} >` with `N` in domain that yields exact `K` (usually fixed `N = K` if that type alone can cover; else count within type).
- **Mixed types, need choose which:** arrows cycle **selection label** in same chrome — e.g. `< 1 x sawmill >` ↔ `< 1 x wood >` when `K = 1`; for `K > 1`, either cycle legal multi-type bundles as one stepper value, or sequential steps each using `< N x {type} >` until `K` filled.
- Confirm submits full `pieceIds` = warriors (if any) + chosen building/token ids.

Collapse tray: do not list every `resolveEvent`+`pieceIds` combo; one removal composer drives the stepper.

### Files to change
- `lib/src/events/battle.ts` (+ tests): exact hit count
- `frontend/phaser/src/assets/gameAssets.ts` (+ tests): item textures
- `frontend/phaser/src/ui/factionBoardViewModel.ts` / `FactionBoardModal.ts`: crafted item icons
- `frontend/phaser/src/ui/CountStepper.ts` / `TurnBanner.ts`: shared `< N x {label} >`
- `frontend/phaser/src/game/marquiseActionComposer.ts` / `eyrieActionComposer.ts`: move → stepper
- `frontend/phaser/src/game/eventActionComposer.ts` / `GameScene.ts` / `ActionTray.ts`: battle removal composer (warriors + buildings/tokens via stepper)

### Test plan
- Lib: under-remove rejected; exact `R` accepted; Battle 4 still holds; building-only overflow still warriors-first.
- Unit: item textures; exhausted in view model.
- Unit: move contiguous → stepper; battle warrior-only / overflow / building-only all use stepper; Confirm builds correct `pieceIds`.
- Manual: March stepper; multi-hit warrior-only; overflow into buildings/tokens via `< N x {type} >` (no tray spam).

### Commit plan
- ~~`chore(phaser): copy item icons into public assets`~~ **done** (`2f1456b`)
- `fix(lib): require exact hit count on battle removal` **← do first (eng)**
  - `lib/src/events/battle.ts`
  - `lib/src/events/battle.test.ts`
- `feat(phaser): register item texture keys`
  - `frontend/phaser/src/assets/gameAssets.ts`
  - `frontend/phaser/src/assets/gameAssets.test.ts`
- `feat(phaser): show items on crafted track`
  - `frontend/phaser/src/ui/factionBoardViewModel.ts`
  - `frontend/phaser/src/ui/FactionBoardModal.ts`
- `feat(phaser): shared count stepper control`
  - `frontend/phaser/src/ui/CountStepper.ts` / `TurnBanner.ts`
  - tests
- `feat(phaser): move uses count stepper`
  - marquise / eyrie march composers + tests
- `feat(phaser): battle removal via stepper`
  - `eventActionComposer.ts` (+ tray/scene)
  - warriors **and** buildings/tokens; cases A/B/C
  - tests
