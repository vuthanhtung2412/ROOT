---
name: markdown-search
description: >-
  Token-lean lookup in large Markdown files (rules, notes, PLAN.md, QA plans)
  by heading: outline first, then pull one section. Use before Reading any
  .md over ~300 lines, when looking up a rule number / heading, or when asked
  to search docs by header.
---

# Markdown Search

Never Read a big `.md` whole. Outline → pick heading → extract section.

## 1. Law of Root rules → CLI first

```bash
pnpm --silent --filter @root/cli start -- rules <7.4 | keywords>
```

Covers `Law_of_Root.md` only. Misses / Rootbotics / other files → step 2.

## 2. Outline (depth-limited)

```bash
grep -nE '^#{1,2} ' FILE    # top level, cheapest
grep -nE '^#{1,3} ' FILE    # one level deeper
grep -nE '^#+ .*Birdsong' FILE  # find heading by keyword
```

Law_of_Root.md: whole file ~26k tokens; h1–h2 ~170; h1–h3 ~950.

## 3. Extract one section (includes subsections)

```bash
mdq '# "7.4 Birdsong"' FILE   # exact-ish title
mdq '# Birdsong' FILE         # substring → every matching section
mdq '# /^7\.4\b/' FILE        # regex
```

`mdq` is installed (`brew install mdq`). Fallback: line number from step 2 →
Read with `offset`/`limit`.

## Avoid

- `mq` section module: stops at next heading of any level (drops subsections)
  and escapes text (`7\.4`).
- `mdsel`: fuzzy search works but ~130 ms/call (Node startup).
