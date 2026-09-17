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
Cite fixes `// Rule: Section > Subsection`. Name tests after rule lines.

## Backend QA

Prefer live stack (engine bugs surface via API too):

```bash
pnpm --filter @root/web dev
pnpm --filter @root/cli start -- new
pnpm --filter @root/cli start -- join alice
pnpm --filter @root/cli start -- join bob
pnpm --filter @root/cli start -- start
# smoke / random play:
pnpm --filter @root/cli start -- auto --turns 50 --players 2
```

Or drive `@root/lib` (`Game.create` / `join` / `start` / `apply` / `legalActions` / `toJSON`) + fixtures in `lib/src/test/fixtures.ts`.

```text
game = start lobby → join seats → start
while no winner and under turn cap:
  play one turn for current seat (legalActions → act)
  check recent GET /game/log + snapshot vs Law_of_Root
  if problem: break
if problem:
  fix code + add vitest in lib (reproduce before-state → action → assert)
  open PR (see template)
else:
  report pass
```

Useful endpoints: `GET /game`, `/game/snapshot`, `/game/actions`, `/game/log`, `POST /game/actions`, `POST /game/undo`.

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

Today UI surface = web API + CLI (+ `GET /game/map.svg` in browser). No separate SPA yet.

1. Create desired state: dump via `GET /game/snapshot` (or craft `GameSnapshot` JSON), then `pnpm --filter @root/cli start -- load path/to.json` (`PUT /game/snapshot?replace=1`). Or build via CLI `new`/`join`/`start`/`act` / lib fixtures.
2. `pnpm --filter @root/web dev` (http://localhost:3000).
3. Chrome DevTools MCP: `navigate_page` → exercise feature (map SVG, actions via CLI/API).
4. Evidence: `take_screenshot` (save under repo tmp/artifacts). No video tool in MCP → screenshot sequence OK; attach files to PR.
5. Open PR with screenshots + short repro steps.
