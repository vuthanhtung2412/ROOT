---
name: self-improve
description: >-
  Capture recurring AI mistakes into durable Skills or AGENTS.md rules.
  Use when the user corrects the agent, says self-improve / update skill /
  update agents.md / remember this / don't do that again, or when the same
  friction appears twice in a session.
---

# Self-improve (skills + AGENTS.md)

Turn repeated corrections into **minimal durable guidance** so next agent turn does not relearn the same lesson.

## Decide where it lives

| Signal | Put it in | Why |
|--------|-----------|-----|
| Always-on for this repo (style, SoT paths, bans) | `AGENTS.md` | Injected every turn |
| Triggered workflow / checklist / domain procedure | `.cursor/skills/<name>/SKILL.md` | Load on demand |
| Cross-repo preference (commit voice, caveman, etc.) | `~/.agents/skills/<name>/SKILL.md` or `~/.cursor/skills/` | Personal, not repo-coupled |
| One-off preference for this chat only | Do **not** write a skill | Just follow user now |

**Prefer skill** when steps, tools, or examples matter. **Prefer AGENTS.md** when a short invariant must never be forgotten.

This repo: project skills live under `.cursor/skills/` (same tree as `.agents/skills/`).

## Workflow

1. **Name the lesson** in one sentence (failure mode → correct behavior).
2. **Search first**: existing `AGENTS.md`, `.cursor/skills/**/SKILL.md`, user rules. Extend; do not duplicate.
3. **Minimal edit**:
   - AGENTS.md: one bullet or short block; no essays.
   - Skill: follow create-skill norms — third-person `description` with WHAT + WHEN; body under ~200 lines; progressive disclosure for long reference.
4. **Wire discovery**:
   - New skill → ensure `description` has trigger phrases the user actually says.
   - Repo-wide invariant → add/adjust an `AGENTS.md` bullet; if a skill owns the procedure, AGENTS.md may point at it in one line.
5. **Verify**: re-read the change as if cold-starting; would a new agent still miss the lesson? If yes, tighten triggers or move up to AGENTS.md.
6. **Commit separately** from feature work when user wants commits (`docs(agents): …` / `dx(skills): …`).

## What to write

- **Concrete**: file paths, commands, forbidden patterns, SoT sources.
- **Negatives that stuck**: "never X; do Y instead" with a tiny good/bad snippet only when ambiguity is high.
- **Not**: session diary, praise, restating general coding knowledge, or rules already covered elsewhere.

## Anti-patterns

- Bloated AGENTS.md (token tax every turn) — push procedures into skills.
- Skill with vague description and no triggers — agent will never load it.
- Copy-pasting the same rule into both AGENTS.md and a skill without a single SoT pointer.
- Writing rules for a mistake seen once with no recurrence signal (unless user explicitly says "remember").

## Quick prompts (user → action)

- "don't do X again" / "remember this" → this skill
- "add to agents.md" → AGENTS.md only (unless they also want a skill)
- "make a skill for …" → create-skill + this skill's placement table
