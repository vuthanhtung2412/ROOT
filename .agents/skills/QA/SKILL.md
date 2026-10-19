---
name: qa
description: >
  Play Root games, check turns against Law of Root, fix rule bugs with unit
  tests, open PRs. Use when user says QA, test game, rule check, playtest,
  backend QA, frontend QA, or asks to verify game rules in play.
---

# QA

Rules SoT: `resources/rules/Law_of_Root.md` (PDF twin same folder).  
Implementable summary (non-SoT): `resources/notes/root-base-rules.md`.  
Manual WA + Vagabond scenarios: `resources/notes/QA-plan-woodland-vagabond.md`  
(one snapshot: `tmp/qa/snapshots/wa-vb-qa-run.json`, regen via `.cursor/skills/QA/make-wa-vb-qa-run.ts`).  
UI improvements demo (one snapshot, recorded replay): `resources/notes/QA-plan-ui-improvements.md`  
(regen via `.agents/skills/QA/make-ui-improvements-qa-run.ts`, replay via `.agents/skills/QA/replay-ui-improvements-qa.mjs`).  
Action dock demo (one snapshot, recorded replay): `resources/notes/QA-plan-action-dock.md`  
(regen via `.agents/skills/QA/make-action-dock-qa-run.ts`, replay via `.agents/skills/QA/replay-action-dock-qa.mjs`).  
Cite fixes `// Rule: Section > Subsection`. Name tests after rule lines.

## Token budget (read first)

Measured costs per read, so pick the cheap path:

- Rules: `pnpm --silent --filter @root/cli start -- rules <8.4.2 | keywords>` (~300 tokens). Never Read `Law_of_Root.md` whole (~40k tokens) or `root-base-rules.md` (~10k); if the CLI misses, use the `markdown-search` skill (grep outline → `mdq` section).
- Game state: CLI `explain` / `log` / `actions` before `show` or raw `GET /game`.
- Browser: `node .agents/skills/QA/qa-ui.ts` (below), ~85% fewer tokens than Chrome DevTools MCP on the same flow. Use the MCP only for what qa-ui lacks: console, network, CSS, performance.
- Screenshots go to files (`qa-ui.ts shot`). Read an image only when the check is visual (layout, art); state checks go through the API.
- Scripts in this folder are long (record-*.mjs 7–13k tokens): `grep -n` the scenario or helper, don't Read whole.

## Backend QA

There a 3 types of backend QA

### Unit Testing

1. Create desired state in a commit: dump via `GET /game/snapshot` (or craft `GameSnapshot` JSON), then `pnpm --filter @root/cli start -- load path/to.json` (`PUT /game/snapshot?replace=1`).
2. Use the CLI to trigger the action
3. Observe new state and report + fix if there is problem

### Auto Testing

1. Let the game run for 25 turns `pnpm --filter @root/cli start -- auto --turns 25 --players 2`
2. Check the logs file and compare with the rules to see if there is any problem
3. Create a commit for each problem to fix and report

### Full QA

1. Play the game with CLI tools solely like how human would
2. Following the steps below
  ```text
  game = start lobby → join seats → start
  while no winner and under turn cap:
    play one turn for current seat (legalActions → act)
    check recent game state developments vs Law_of_Root
    if problem: break
  if problem:
    fix code + add vitest in lib (reproduce before-state → action → assert)
    open PR (see template)
  else:
    report pass
  ```
3. Gameplay must be intentional to arrive at an edge case


### PR template (backend)

```markdown
## Problem
<rule cite + what went wrong>

## Before
- state: <snapshot or key fields>
- action: <Action JSON>
- log: <relevant events>

## After fix
- same action on before-state → <diff / expected state>
- test: `<path>`
```

## Frontend QA

1. Create desired state: dump via `GET /game/snapshot` (or craft `GameSnapshot` JSON), then `pnpm --filter @root/cli start -- load path/to.json` (`PUT /game/snapshot?replace=1`). Or build via CLI `new`/`join`/`start`/`act` / lib fixtures. Helper: `pnpm --filter @root/lib exec tsx ../../.cursor/skills/QA/make-snapshots.ts` (writes `tmp/qa/snapshots/`).
2. `pnpm --filter @root/web dev` (http://localhost:3000) + `pnpm --filter @root/react dev` (Vite, often `:5173`/`:5174`).
3. Open the React UI → **QA: Continue loaded game** (not **Start game** — that replaces the snapshot). Autoload shortcut (Vite dev only, skips the CLI `load`): open `/?qaSnapshot=tmp/qa/snapshots/<name>.json` (repository-relative, or env `ROOT_QA_SNAPSHOT_PATH`) → the button first loads that file into the slot. Every click reloads the file, so progress is lost; a page reload alone re-enters the game and keeps progress. Drive the feature in the DOM (action tray, clearings, Confirm) — the UI is React, no canvas. Use `qa-ui.ts` (one headless Chromium kept alive between calls; env `ROOT_REACT_URL`):
   - `node .agents/skills/QA/qa-ui.ts open <snapshot>.json` → autoloads `tmp/qa/snapshots/<snapshot>.json`, presses **QA: Continue**, prints the view: `> text` (visible prompt/heading), `- name` (control a click really hits; covered/disabled ones hidden; repeats as `name (2)`).
   - `click <name>` → prints only what changed (`gone`/`new` lines); `view` → full view again.
   - `shot <name>` → `tmp/artifacts/<name>.png` (never overwrites); `close` when done.
4. Evidence under `tmp/artifacts`: screenshots and/or video. Record: `ROOT_REACT_URL=http://localhost:5173 node .cursor/skills/QA/record-fe-qa-scenarios.mjs [scenario]` (template for new record scripts). Stale, Phaser-era (drive `window.__ROOT_PHASER_GAME__` / canvas coords, gone from the React UI): `record-ui-scenario.mjs`, `record-bug-scenarios.mjs`, `qa-crafted-cards-modal.mjs` — port to DOM selectors before use. First time: `cd .cursor/skills/QA && npm i && npx playwright install chromium`. Click highlight: `click-highlight.mjs` (auto red blink). After UI, verify via `GET /game` + `/game/log` (not screenshot alone).
5. Never overwrite or delete an existing video in `tmp/artifacts` — a passed video is evidence. Record scripts save re-runs as `<name>-rerun-<timestamp>` via `pick-unused-video-name.mjs`; new record scripts must use it too. No manual `rm`/`mv`/`ffmpeg -y` onto an existing video.
6. Open PR with evidence + short repro steps.
