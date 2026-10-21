# Clearing priorities per map (Rootbotics 2.1)

The number printed on each clearing of a map is its **priority marker**: `1` is the
highest priority. Bots break ties by priority (`lib/src/factions/bots/priority.ts`).

## Fall (in the engine)

Engine clearing id + 1 = printed number = priority. Checked against the printed map
(suits and all 18 paths match), so the ids stay as they are.

| Priority | Engine id | Suit   | Paths to (priority)  | Notes          |
| -------- | --------- | ------ | -------------------- | -------------- |
| 1        | 0         | fox    | 5, 9, 10             | NW corner      |
| 2        | 1         | mouse  | 5, 6, 10             | NE corner      |
| 3        | 2         | rabbit | 6, 7, 11             | SE corner      |
| 4        | 3         | rabbit | 8, 9, 12             | SW corner      |
| 5        | 4         | rabbit | 1, 2                 |                |
| 6        | 5         | fox    | 2, 3, 11             | ruin           |
| 7        | 6         | mouse  | 3, 8, 12             |                |
| 8        | 7         | fox    | 4, 7                 |                |
| 9        | 8         | mouse  | 1, 4, 12             |                |
| 10       | 9         | rabbit | 1, 2, 12             | ruin           |
| 11       | 10        | mouse  | 3, 6, 12             | ruin           |
| 12       | 11        | fox    | 4, 7, 9, 10, 11      | ruin, centre   |

## Lake, Winter, Mountain (not in the engine yet)

Read by eye from the printed map images; check them against the map before using
them. Suits are not printed (they are set up at random on these maps). When one of
these maps is added, give it clearing id = printed number − 1, like Fall, so
`clearingPriority(id) = id + 1` holds on every map.

### Lake

Paths: 2–7, 2–8, 2–10, 7–6, 7–10, 7–11, 6–4, 6–11, 4–5, 11–5, 5–1, 8–10, 8–3,
3–12, 3–9, 12–9, 9–1. The lake lies between 10, 11, 12 and 1.

### Winter

Paths: 1–5, 1–10, 1–11, 5–6, 6–2, 2–12, 2–7, 10–4, 11–4, 11–9, 4–9, 9–8, 8–12,
8–3, 12–3, 7–3.

### Mountain

Paths: 1–8, 1–9, 8–4, 4–12, 9–10, 9–12, 12–10, 12–7, 10–5, 10–11, 5–11, 2–11,
2–6, 11–3, 6–3.
Mountain passes (thick lines, closed at the start): 5–2, 9–5, 8–9, 12–11, 11–6, 7–3.
