- Reply in the language of the user's latest message (English question → English answer, caveman style still applies). Never switch language on your own.
- Prefer language for anything is typescript
  - Exception: scripts that only glue CLIs together (`gh`, `git`, `tailscale`, `curl`, process start/stop) → bash in `scripts/`
- If there is a script to do certain thing use it (boostrap ts project, generate client) instead of modifying code
- Rules **SoT** = `./resources/rules/Law_of_Root.pdf` (markdown twin: `./resources/rules/Law_of_Root.md`).
  - Clockwork / electric-bot **SoT** = `./resources/rules/Law_of_Rootbotics.pdf` (markdown twin: `./resources/rules/Law_of_Rootbotics.md`). Errata: `./resources/rules/Electric_Eyrie_Errata.pdf`.
  - Simplified implementable summary (non-SoT): `./resources/notes/root-base-rules.md`
  - Manual QA (Woodland + Vagabond): `./resources/notes/QA-plan-woodland-vagabond.md`
  - Build plan: `./resources/notes/grand-plan-toward-base-game.md` + commit plan in `PLAN.md`
- Commit as soon as a step in the plan is done.
- Stay close to the commit plan in PLAN.md and if something need tweak stop and ask user.
- All unit tests should use fixture factory or mock of any kind.
- No abbreviation in the code, please use explicit naming so that it is easy to review. explicitness > verbosity
- Art SoT = `resources/reference/` (`.glb` in Git LFS). Game files in `frontend/react/public/assets/` are relative symlinks to it (`git add -f` for `.glb`), never copies; export/edit art in `resources/reference/`.

- Function should have less than 5 params. If they are to big create a broader scope interface

```typescript
# ❌ BAD

export function moveWarriors(
  state: GameState,
  seat: Seat,
  from: ClearingId,
  to: ClearingId,
  count: number,
  ctx: Ctx,
)

// ✅ GOOD

interface Movement  {
  seat: Seat,
  from: ClearingId,
  to: ClearingId,
  count: number,
}


export function moveWarriors(
  state: GameState,
  movement: Movement,
  ctx: Ctx,
)
```

+ All variable, function signature must have an explicit type, ban `any` and `unknown`

+ Don't use unsafe `as` use explicit typeguard instead
```typescript
// ❌ BAD

function handleFile(file: Object) {
	file = file as ImageFile
}

// ✅ GOOD
function isImage(file: ImageFile | VideoFile): file is ImageFile {
  return file.type === "image"
}

function isVideo(file: ImageFile | VideoFile): file is VideoFile {
  return file.type === "video"
}
```

+ No mutation of function parameters

```tsx
// BAD ❌
function addItem(items: string[], newItem: string) {
  items.push(newItem);
  return items;
}

// GOOD ✅
function addItem(items: string[], newItem: string) {
  return [...items, newItem];
}
```

+ Make as few code modification as possible for a feature

+ No magic number or strings create descriptive constant
```typescript
// BAD ❌

const velocity = time * 9.8

// GOOD ✅
const EARTH_GRAVITY_ACCELERATION = 9.8
const velocity = time * EARTH_GRAVITY_ACCELERATION

```

+ Always import with absolute path
+ A file should have max 500 line and ideally around 200 - 300 lines. if the number of lines exceed limit consider consider splitting component or adding helper function.
+ Frontend styling: Tailwind utility classes in TSX. No new `.css` files or BEM classes; theme tokens live in `frontend/react/src/style.css` `@theme`. Repeated class sets become named constants. Keep bare hook class names that QA scripts select on.
