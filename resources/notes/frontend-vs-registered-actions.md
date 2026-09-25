# Frontend staging vs backend-registered actions

Two kinds of “action” in play:

1. **Action under resolution** (frontend staging) — lives only in Phaser composer draft / workflow. Not in `GameState`. May take multiple UI steps. Can cancel mid-flow. Detected by `isActionUnderResolution()` / march `isActive()` ([`frontend/phaser/src/game/resolution/`](../../frontend/phaser/src/game/resolution/)). March uses procedural `resolveMarch` (`workflows/march.ts`).
2. **Backend-registered** — submitted via `POST /game/actions` → `game.apply()` → mutates `GameState` (and may push `state.pending`).

Cancel rule for (1): clear composer draft, **`GameSession.refresh()`** (fetch + sync board/HUD) — needed when UI showed optimistic preview, e.g. march legs.

### ActionTray rule

| Situation | Tray |
|-----------|------|
| Idle — voluntary legal specs (immediate apply **or** start under-resolution) | **ON** — tray is start menu (`recruit`, `endPhase`, `march`, `build`, `battle`, …) |
| Action under resolution (`isActionUnderResolution`) | **OFF** — board / hand / banner / overlay own input |
| Forced pending prompt (Ambush, Field Hospitals, keep / starting building / leader) | **OFF** — auto-prompt → banner/hand; **not** tray choices |

Tray shows triggers for registered / startable daylight actions. Tray hides while under resolution. Forced `resolveEvent` prompts never live on tray.

---

## 1. Action under resolution (not in backend until submit)

Intermediate picks stay in composer draft / overlay. Backend sees nothing until outcome `kind: 'ready'` posts a ClientAction.

| Staging flow | ActionSpec / draft | Multi-step? | Cancel |
|--------------|-------------------|-------------|--------|
| March | `march` | yes — from → to → count, optional 2nd leg; board preview | yes → idle + **refresh** |
| Build | `build` | yes — clearing → building type | yes → idle + **refresh** |
| Battle start | `battle` | yes — clearing → defender | yes → idle + **refresh** |
| Overwork | `overwork` | yes — card → sawmill clearing | yes → idle + **refresh** |
| Craft | `craft` | pick card | yes → idle + **refresh** |
| Spend birdsong bird | `spendBird` | pick card | yes → idle + **refresh** |
| Discard to hand size | `discard` | multi-select → Confirm | yes → idle + **refresh** |
| Add to Decree | `addToDecree` | card × column (1–2 cards) | limited (forced birdsong; cancel only clears pending second pick) |
| A New Roost | `newRoost` | pick clearing | yes → idle + **refresh** |
| Decree column | `decree` | recruit/build: clearing; battle: clearing → defender; move: from → to → count | yes → idle + **refresh** |
| Resolve pending (UI draft) | `resolveEvent` staging | see below | varies |

### `resolveEvent` UI drafts (pending **is** on backend; pick UI is not)

`state.pending` already registered. Composer draft only chooses how to resolve until `resolveEvent` posts.

| Draft | Multi-step? | Cancel |
|-------|-------------|--------|
| Field Hospitals — pick card / Decline | pick or decline | Decline = submit `{ decline: true }` (not silent cancel) |
| Ambush / foil — pick card / skip | pick or decline | skip = submit `{ decline: true }` |
| Battle — pick card | pick | yes → idle + **refresh** |
| Battle — removal / effect / seat order | pick | yes → idle + **refresh** |
| Place keep / starting building / choose leader | pick | usually **no** cancel (`canCancel: false`) |

---

## 2. Backend-registered (applied to `GameState`)

### Immediate (no under-resolution — `ready` on `begin`)

| Action | Notes |
|--------|--------|
| `birdsongWood` | Marquise birdsong wood |
| `eveningDraw` | draw |
| `emergencyOrders` | Eyrie |
| `eveningScore` | Eyrie roost score |
| `endPhase` | advance phase/step |
| `recruit` | Marquise recruit (no clearing pick in UI) |
| `turmoil` | Eyrie turmoil |

### Submitted after under-resolution completes

Same `Action` types as §1, once composer emits `ready`:

- `march`, `build`, `battle`, `overwork`, `craft`, `spendBird`, `discard`
- `addToDecree`, `newRoost`, `decree`
- `resolveEvent` (cardId / decline / pieceIds / clearing / leader / useEffect / order / …)

### Lobby / setup (backend, not daylight tray)

| Action | Notes |
|--------|--------|
| `join` | seat join |
| `start` | start game |

### In `Action` union, not wired in Phaser composers yet

Persistent / dominance-style (backend types exist; no frontend under-resolution list yet):

- `swapMeet`, `charmOffensive`, `informantsTakeAmbush`
- `leagueMove`, `leagueBattle`
- `propagandaBureau`, `saboteurs`, `falseOrders`, `eyrieEmigre`

---

## Rule of thumb

| Question | Action under resolution | Backend-registered (voluntary) |
|----------|-------------------------|--------------------------------|
| Where state lives mid-flow? | composer draft + optional board preview | `GameState` / `pending` / history |
| Cancel mid-flow? | yes (or decline for forced prompts) | N/A — already applied; use undo if exposed |
| After cancel to idle | **`session.refresh()`** | — |
| Tray? | **OFF** while under resolution | **ON** when idle — button starts apply or under-resolution |
| Forced pending? | banner/hand; tray **OFF** | event already in `state.pending`; not a tray item |

Also: modal open / not local actor / game finished → tray **OFF** (see `REPORT.md` / `shouldDisableActionTray`).

Source of truth for submitted shapes: `lib/src/actions/types.ts` (`Action`). Staging flows: `frontend/phaser/src/game/resolution/` (see README). Tray: `actionTrayDisable.ts`.
