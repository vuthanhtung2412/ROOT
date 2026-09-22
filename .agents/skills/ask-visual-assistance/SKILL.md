---
name: ask-visual-assistance
description: >-
  Get human visual layout help via a minimal web app in tmp/ (drag/resize
  regions on reference art) when placing UI on faction boards, cards, or maps.
  Open helper + prompt user through chrome-devtools MCP.
---

# Ask Visual Assistance

## Medium (preferred)

**Minimal web app in `tmp/`** so the human marks regions precisely. No frameworks, no npm, no polish.

Project default: `tmp/board-layout-helper/index.html`  
(`tmp/` is gitignored — local only, **do not commit**.)

| Need | Helper does |
| --- | --- |
| Load board / card scan | File picker or relative path to `resources/reference/…` |
| Place regions | Drag, resize, name boxes (`id`) |
| Hand off to agent | Export JSON (copy button + `window.__layoutExport`) |

If helper **missing**: create **one** minimal `index.html` (+ tiny inline JS/CSS) under `tmp/board-layout-helper/`, then open it via **chrome-devtools MCP** and prompt. Verbal / screenshot = fallback only.

## When to use

- UI must align to **reference art** and guessing pixel boxes is risky.
- User says they can mark regions, drag/drop, or resize placeholders.
- Agent cannot decode/read an image well enough to locate a track, token slot, or text block.

## When not to use

- Pure logic / rules / API work with no spatial layout.
- Text-only UI with no dependency on board scan geometry.

## Workflow

1. **Stop guessing.** Do not invent hotspot coordinates.
2. **Ensure helper exists** at `tmp/board-layout-helper/index.html`. If absent → write minimal single-page helper (see requirements).
3. **Open + prompt via chrome-devtools MCP** (do not only paste a path in chat):
   - Discover tools: `GetDynamicTools` namespace `chrome-devtools`.
   - Resolve absolute helper URL: `file://` + absolute path to `tmp/board-layout-helper/index.html`. If `file://` blocks images → `npx serve tmp/board-layout-helper` then use `http://localhost:…`.
   - `list_pages` → `new_page` (or `navigate_page` on existing) with that URL → `select_page` `bringToFront: true`.
   - Optional: `take_snapshot` + `upload_file` on the file input to load the reference art path.
   - In chat (one short ask): list needed region `id`s + reference path; tell user to mark in the **Chrome tab MCP opened**, then say **done** (or click Export).
4. **Collect JSON** after user finishes:
   - Prefer `evaluate_script` reading `window.__layoutExport` (or `#export-json` text).
   - Else accept pasted JSON from chat.
5. **Wire** regions into Phaser/CSS. Do not re-derive from the image unless verifying a mismatch.
6. **Fallback** only if chrome-devtools MCP unavailable/broken: tell user to open helper manually; still same JSON contract. Screenshot markup / % bands last resort — store as explicit rects.

## Helper app requirements (keep minimal)

- **One file** preferred: `tmp/board-layout-helper/index.html` (inline CSS/JS OK). No README unless asked.
- Load image (file input enough; optional preset list of character-board webps).
- Named rects: add, select, drag, resize, delete, rename `id`.
- Coords vs natural image size (`unit: "px"`) or `%` (`unit: "percent"`).
- Export pretty JSON to clipboard (download optional).
- On export (and whenever regions change after export click): set `window.__layoutExport` to the same JSON object string/object so chrome-devtools `evaluate_script` can read it.
- No build, no deps, no login, no design system.

## Agent behavior

- Caveman-OK short ask; JSON contract exact.
- **Always try chrome-devtools MCP first** to open helper and surface the prompt tab to the user.
- Prefer writing the tiny helper over long coord guesswork.
- Consume regions in one commit-sized change — no unrelated refactors.
- Never claim “I see the board” unless the image was actually read this turn.
- **Never git-add `tmp/`.**

## Sample output contract

```json
{
  "image": "resources/reference/character-boards/marquise-de-cat/marquise-de-cat-front.webp",
  "unit": "px",
  "naturalWidth": 1600,
  "naturalHeight": 1242,
  "tracks": [
    { "id": "sawmill", "cells": 6, "cellSize": 101, "gaps": [20, 23, 22, 25, 25], "x": 774, "y": 482 }
  ],
  "regions": [
    { "id": "buildings-track", "x": 0, "y": 0, "width": 0, "height": 0 }
  ]
}
```

### Coordinate system (precise)

- **Origin:** top-left of the **natural** image (`0,0` = image top-left). Not center. Not display CSS pixels after scale.
- **Region / cell rect:** `{ x, y, width, height }` where **`x,y` = top-left corner** of the box, `width`/`height` extend right/down. Same as CSS `left`/`top`/`width`/`height` in the helper (`syncRegionDom`).
- **Track stack:** `tracks[].x,y` = top-left of cell `0`; later cells use `cellSize` + `gaps[]` (or exported `regions` like `sawmill-3`).
- **Not** center-point coords. Do **not** treat `x,y` as sprite position with origin `(0.5,0.5)`.
- **Wiring tokens/icons:** after scaling the rect onto the displayed board, set sprite **origin `(0,0)` at rect `x,y` (top-left)** and **`setDisplaySize(width, height)`** so the art fills the marked box. Leader cards may uniform-scale (contain) from the same top-left. Text overlays also use top-left of the rect.
