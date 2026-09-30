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
Cite fixes `// Rule: Section > Subsection`. Name tests after rule lines.

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
3. Open Phaser → **Continue loaded game** (do not New GP2 — that replaces the snapshot). Drive the feature on canvas (action tray, clearings, Confirm). Chrome DevTools MCP OK for screenshots/console; canvas clicks need coords or Playwright.
4. Evidence under `tmp/artifacts`: screenshots and/or video. Record: `ROOT_REACT_URL=http://localhost:5174 node .cursor/skills/QA/record-ui-scenario.mjs <march|turmoil>`. First time: `cd .cursor/skills/QA && npm i && npx playwright install chromium`. Click highlight: `click-highlight.mjs` (auto red blink). After UI, verify via `GET /game` + `/game/log` (not screenshot alone).
5. Open PR with evidence + short repro steps.
