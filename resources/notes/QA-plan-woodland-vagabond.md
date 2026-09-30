# QA plan — Woodland + Vagabond (one run)

**One snapshot. One continuous play sequence.** Each step lists **Hits** (`W#` / `V#`).

| | |
|---|---|
| Snapshot | `tmp/qa/snapshots/wa-vb-qa-run.json` |
| Regen | `cd lib && pnpm exec tsx ../.cursor/skills/QA/make-wa-vb-qa-run.ts` |
| Rules | `resources/rules/Law_of_Root.md` |

---

## Setup

1. Regen snapshot (optional).
2. `pnpm --filter @root/web dev` + `pnpm --filter @root/react dev`
3. `pnpm --filter @root/cli start -- load tmp/qa/snapshots/wa-vb-qa-run.json`
4. React → **Continue loaded game** (not New Game)
5. After each step: board + `GET /game` / `/game/log`

**Seats:** `0` Marquise · `1` Eyrie · `2` Alliance · `3` Vagabond  

**Start:** Alliance Birdsong / `revolt`

### Board cheat-sheet

| Clearing | Suit | Pre-placed |
|----------|------|------------|
| **7** | fox | Sympathy, 2 Cat warriors, wood, **VB pawn** — **revolt here** |
| **3** | rabbit | 3 Cat warriors — Martial Law spread |
| **6** | mouse | WA + Cat + Eyrie warriors — multi-enemy battle |
| **8** | mouse | WA warrior — Organize |
| **5** | fox | Sympathy + ruin `{boot, hammer}` + 1 Cat warrior — Explore + Hostile fight |
| **0** | fox | Sympathy — Cat Outrage march target |
| **1** | mouse | **Keep** + sympathy |
| **4** | rabbit | 2 Cat warriors — march into 0 later |
| **11** | fox | Sympathy |

---

## Case index

| ID | Case |
|----|------|
| W1 | Revolt wipe → base → warriors → +officer |
| W2 | Revolt → Field Hospitals |
| W3 | Revolt vs VB → damage 3 items, pawn stays |
| W4 | Spread + supporter pick |
| W5 | Martial Law (+1 supporter) |
| W6 | Outrage — enemy moves into sympathy |
| W7 | Outrage — enemy removes sympathy |
| W8 | Alliance self move into sympathy — **no** Outrage |
| W9 | Evening Move via officers |
| W10 | Recruit / Organize / Battle ops |
| W11 | Multi-enemy battle — pick defender |
| W12 | Guerrilla War (WA defends) |
| W13 | Daylight craft / mobilize / train |
| W14 | Base removed cleanup |
| V1 | Explore +1 VP; last item removes ruin |
| V2 | Two-item ruin — pick / Explore again |
| V3 | Quest VP or draw 2 |
| V4 | Craft via hammers |
| V5 | Refresh + Slip |
| V6 | Daylight Move (Hostile extra boot) |
| V7 | Hostile Infamy (battle yes / strike no) |
| V8 | Aid / relationship |
| V9 | Repair / evening capacity |
| V10 | Full wipe damages VB (= W3) |

---

## Sequence

Play top → bottom. Do **not** reload between steps (unless Fail → regen).

### Part 1 — Alliance Birdsong

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 1 | Tray → **Revolt** → pick clearing **7** (not 0/5/11) → pick 2 fox supporters → Confirm | Enemies wiped; fox **base** + warriors; officers +1; VP for wood | **W1** | ☐ |
| 2 | Prompt switches to Cat **Field Hospitals** | Pay fox/bird card or Decline | **W2** | ☐ |
| 3 | As Cat: pay **fox** card (`ROOT-202#fh`) | 2 warriors appear at **keep (1)** | **W2** | ☐ |
| 4 | Check VB on 7 | Pawn still there; **3** items in Damaged | **W3** **V10** | ☐ |
| 5 | **End phase** → Spread | Step = `spread` | | ☐ |
| 6 | **Spread sympathy** → clearing **3** → spend **3** rabbit supporters | Sympathy on 3; cost 2+1 Martial Law | **W4** **W5** | ☐ |
| 7 | **End phase** → Daylight | | | ☐ |

### Part 2 — Alliance Daylight

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 8 | **Mobilize** → mouse hand card | Card → Supporters | **W13** | ☐ |
| 9 | **Train** → fox hand card | +1 officer (base on map) | **W13** | ☐ |
| 10 | **Craft** → Anvil (`ROOT-204`) | Crafted via fox sympathy | **W13** | ☐ |
| 11 | **End phase** → Evening military | `militaryOpsLeft` = officers | | ☐ |

### Part 3 — Alliance Evening (officers)

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 12 | **Move** warrior **8 → 0** (into own sympathy) | Move OK; **no** Outrage pending | **W8** **W9** | ☐ |
| 13 | **Battle** on clearing **6** → UI asks defender → pick **Cat or Eyrie** | Must choose one seat | **W11** **W10** | ☐ |
| 14 | Resolve battle (ambush skip OK) | Hits resolve; ops tick down | **W10** | ☐ |
| 15 | **Recruit** at clearing **7** | +1 WA warrior | **W10** | ☐ |
| 16 | **Organize** on clearing **8** (or 6 if warrior left) | Sympathy placed; track VP | **W10** | ☐ |
| 17 | **End phase** through draw/discard | Turn passes → **Vagabond** Birdsong | | ☐ |

### Part 4 — Vagabond Birdsong + Daylight

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 18 | **Refresh** (auto or tray) | Exhausted items flip; count ≈ 3+2×tea | **V5** | ☐ |
| 19 | **Slip** toward clearing **5** (or adj toward 5) | Free move; no boot | **V5** | ☐ |
| 20 | **End phase** → Daylight if needed | | | ☐ |
| 21 | **Move** with boot onto clearing **5** (ruin) if not there | Boot exhausts; Nimble OK | **V6** | ☐ |
| 22 | **Explore** → pick one of two ruin items | Item gained; +1 VP; ruin keeps other | **V2** **V1** | ☐ |
| 23 | **Explore** again (2nd torch) | Take last item; ruin removed; +1 VP | **V1** **V2** | ☐ |
| 24 | On a **fox** clearing: **Quest** → `QUEST-F-SHED` → exhaust hammer+torch | Quest completes; replacement drawn | **V3** | ☐ |
| 25 | Choose reward **VP** | Score = # completed fox quests | **V3** | ☐ |
| 26 | **Craft** Anvil if still in hand + hammers | Item to satchel/track | **V4** | ☐ |
| 27 | **Aid** Eyrie (pieces in clearing; give matching card; optional take crafted boot) | Relationship / item transfer | **V8** | ☐ |
| 28 | **Battle** Cat (Hostile) in shared clearing if possible | Infamy VP path | **V7** | ☐ |
| 29 | Or **Strike** Cat warrior | Remove warrior; **no** Infamy | **V7** | ☐ |
| 30 | **Repair** one Damaged item with hammer | Leaves Damaged; keeps face | **V9** | ☐ |
| 31 | Optional: **Strike** a lonely sympathy (no warriors) | Outrage on VB → give/show | **W7** | ☐ |
| 32 | Evening: if over capacity, cull extras | Items removed from game | **V9** | ☐ |
| 33 | Finish VB turn → **Marquise** Birdsong | | | ☐ |

### Part 5 — Marquise (Outrage + Guerrilla + base)

| # | Do | Expect | Hits | ☐ |
|---|----|--------|------|---|
| 34 | Cat Birdsong wood → **End phase** → Daylight | | | ☐ |
| 35 | **March** warriors **4 → 0** (into sympathy) | **Outrage** pending on Cat | **W6** | ☐ |
| 36 | Give matching card (fox/bird) → Supporters | Or no-match → show hand → WA draws | **W6** | ☐ |
| 37 | **Battle** Alliance on clearing **7** (WA defends) | Guerrilla: WA deals **higher** die | **W12** | ☐ |
| 38 | If base removed in battle | Supporters of fox discarded; half officers up; cap if no bases | **W14** | ☐ |

---

## Coverage matrix

| Case | Steps | ☐ |
|------|-------|---|
| W1 | 1 | ☐ |
| W2 | 2–3 | ☐ |
| W3 / V10 | 4 | ☐ |
| W4 | 6 | ☐ |
| W5 | 6 | ☐ |
| W6 | 35–36 | ☐ |
| W7 | 31 | ☐ |
| W8 | 12 | ☐ |
| W9 | 12 | ☐ |
| W10 | 13–16 | ☐ |
| W11 | 13 | ☐ |
| W12 | 37 | ☐ |
| W13 | 8–10 | ☐ |
| W14 | 38 | ☐ |
| V1 | 22–23 | ☐ |
| V2 | 22–23 | ☐ |
| V3 | 24–25 | ☐ |
| V4 | 26 | ☐ |
| V5 | 18–19 | ☐ |
| V6 | 21 | ☐ |
| V7 | 28–29 | ☐ |
| V8 | 27 | ☐ |
| V9 | 30, 32 | ☐ |

**Stretch / may need luck:** W14 (enough hits to kill base), V7 Infamy (need Cat warrior in VB clearing after revolt), Hostile extra boot (V6 dest with Hostile warriors).

**Do not:** Revolt clearing **0** or any keep clearing — breaks Field Hospitals path.

---

## Fail notes

| Step | Symptom | Likely cause |
|------|---------|--------------|
| 1 | No revolt on 7 | Wrong snapshot / sympathy missing |
| 2 | No Field Hospitals | Picked wrong revolt clearing (no Cat warriors) |
| 4 | Pawn gone | Bug (pawn must never leave) |
| 6 | Cost not 3 | Martial Law not applied / wrong clearing |
| 13 | No defender pick | Only one enemy left on 6 |
| 35 | No Outrage | Marched into non-sympathy / Alliance mover |
