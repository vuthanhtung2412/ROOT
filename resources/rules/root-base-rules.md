# Root — Base Rules (Implementable)

Source: Leder Games, *The Law of Root* (June 4, 2022).  
Scope: **Fall map** + **Marquise / Eyrie / Alliance / Vagabond** (Thief, Tinker, Ranger).  
Expansions, Winter/Lake/Mountain, hirelings, landmarks omitted.

Official: https://ledergames.com/pages/resources · PDF: `Law_of_Root.pdf`

---

## How to use this doc

| If you need… | Go to |
|---|---|
| Win / score / dominance | [Victory](#victory) |
| Shared verbs (craft / move / battle) | [Shared actions](#shared-actions) |
| Board setup checklist | [Setup](#setup) |
| Faction turn loops | [Marquise](#marquise-de-cat) · [Eyrie](#eyrie-dynasties) · [Alliance](#woodland-alliance) · [Vagabond](#vagabond) |

**Interpretation rules**

1. Card vs Law → follow card. Learn-to-Play vs Law → follow Law. Faction rule vs general → follow both if possible; else faction.
2. **Cannot** is absolute unless a rule explicitly overrides it.
3. Unclear simultaneous order / who decides → current turn player chooses.
4. Terms are literal (`move` ≠ `place`).
5. No consent needed for actions. Agreements are non-binding. Cards only change hands when a rule says so.

---

## Game loop

```
SETUP
→ clockwise turns until someone wins
  each turn = Birdsong → Daylight → Evening
→ first to 30 VP (or activated dominance / coalition) wins
```

- “At start of phase” resolves before other phase content.
- “At end of phase” resolves after other phase content, before next phase.
- Do not interrupt an action / ability / persistent effect unless the interrupting effect says it can (e.g. “In battle…”).

---

## Victory

### Standard win

- First player to **30 VP** wins **immediately**.
- If several hit 30+ at once → current turn player wins.

### Universal scoring (any faction)

| Event | VP |
|---|---|
| You remove an enemy **building** or **token** | +1 each |
| You craft an **item** | VP printed on the card (Eyrie override: see faction) |

Faction-specific scoring is in each faction section.

### Dominance cards (alt win)

Deck has 4 dominance cards (mouse / rabbit / fox / bird).

- May be **spent for suit** like any card; **cannot be crafted**.
- If a dominance would go to discard → place it **available** near the map instead.
- **Take available** (Daylight): spend a matching-suit card; take it to hand. Available **bird** dominance cannot be treated as another suit.

**Activate** (Daylight): if you have ≥ **10 VP**, place dominance from hand in play area; remove score marker from track. You no longer score VP.

| Activated card | Win check (start of **your** Birdsong) |
|---|---|
| Mouse / Rabbit / Fox | Rule **3** clearings of that suit |
| Bird | Rule **2** clearings in **opposite corners** |

Activated dominance: ignores hand limit; cannot leave play; cannot be swapped.

**Vagabond** cannot use normal dominance win — see [Coalitions](#dominance--coalitions).

---

## Board model

### Clearings & paths

- Map = clearings linked by **paths**.
- **Adjacent** = linked by a path.
- Each clearing has a **suit**: mouse, rabbit, or fox.
- **Slots** = white boxes for buildings. No open slot → cannot place building.
- Slots marked **R** start with **ruins**. Ruins only leave when a rule says so (Vagabond Explore).

### Rivers & forests

- **Rivers** link clearings but are **not** paths (unless a rule says treat as path). Do not split clearings/forests.
- **Forest** = area enclosed by printed paths + clearings.
- Forest adjacent to: clearings that touch it without crossing a path; forests separated by only one printed path.

### Rule (control)

A player **rules** a clearing if they have more **warriors + buildings** there than every other player.

- Tokens and pawns do **not** count toward rule.
- Tie → **no one** rules.

**Faction overrides**

- **Eyrie**: win ties if they have ≥1 Eyrie piece there (*Lords of the Forest*).

### Pieces

- Pieces limited to box contents — no proxies.
- Ownership never changes.
- Place / take / remove as much as possible if you cannot do the full amount (does **not** waive costs/prerequisites).
- Forced actions resolve as if that player chose them (they still get their abilities).

### Public info

- Hand size public; card faces private unless revealed.
- Discard searchable anytime.

---

## Cards

Shared deck + shared discard. Empty deck → shuffle discard into new deck.

| Suit | Notes |
|---|---|
| Bird | Wild (see below) |
| Fox / Rabbit / Mouse | Match clearing suits |

Most cards have a craft effect.

### Birds are wild

- May treat bird as any other suit (including when paying several of one suit).
- **Forced** discard/give of non-bird suits → must use birds as that suit if needed.
- Prompted to spend/discard/take/give a **bird** → cannot substitute non-bird.

### Ambush cards

5 total: 1 mouse, 1 rabbit, 1 fox, 2 birds.

- Spend for suit; **no craft effect**.
- Play in battle as defender (and foil as attacker) — see [Battle](#battle).

---

## Shared actions

### Craft

1. Activate crafting pieces whose suits match the cost icons (bottom-left of card).
2. Crafting piece suit = suit of its clearing.
3. Each crafting piece activates **once per turn**.
4. `?` = any suit.

| Effect type | Resolve |
|---|---|
| Immediate (paper) | Do effect → discard. If item shown: take matching item from map supply → Crafted Items (or Vagabond satchel/track). Missing supply item → cannot craft. |
| Persistent (stone) | Place in play area; use as written. No duplicate identical persistent. |

Faction says **when** / **what** crafts (workshops, roosts, sympathy, hammers…).

### Move

1. Take **>0** of your warriors/pawns from one clearing.
2. Move them to **one** adjacent clearing.
3. Must **rule** origin, destination, or both (unless Nimble / faction exception).
4. Same piece may move many times per turn if multiple moves allowed.

### Battle

**Declare:** clearing with ≥1 of your warriors/pawns → you = attacker; choose one enemy there = defender.

#### Step 1 — Ambush

Defender may play **one** ambush matching clearing suit.

1. **Foil (optional):** attacker plays matching ambush → defender discards ambush; skip Resolve Ambush.
2. **Resolve Ambush:** defender deals **2 hits** immediately → discard ambush. If no attacking warriors/pawns left → battle ends.

#### Step 2 — Roll

Roll both dice.

- Attacker will deal hits = **higher** die.
- Defender will deal hits = **lower** die.
- Equal rolls → same number each.
- Hits applied in Step 4.

**Max rolled hits** = number of **your warriors** in the clearing (attacker or defender).  
Vagabond: max rolled hits = undamaged **swords** in Satchel (face up or down).

#### Step 3 — Optional effects

Attacker / defender may use optional battle effects. Both want to → attacker picks who goes first.

- **Extra hits** ignore warrior-count cap.
- **Defenseless:** defender has no warriors → attacker deals +1 hit.  
  Vagabond is defenseless if no undamaged swords.

**Alliance Guerrilla War:** as defender, Alliance deals the **higher** die; attacker deals the **lower**.

#### Step 4 — Deal hits

Each hit removes one of the other side’s pieces from the clearing.

- Score +1 VP per enemy building/token removed.
- Victim chooses removal order, but: **all their warriors there first**, then buildings/tokens.
- Victim chooses order of their triggered effects.

---

## Setup

Use **Fall** map (front of board). Standard setup for new players.

### Reach (interesting mix)

| Players | Min total Reach |
|---|---|
| 2 | 17+ |
| 3 | 18+ |
| 4 | 21+ |

| Faction | Reach |
|---|---|
| Marquise de Cat | 10 |
| Eyrie Dynasties | 7 |
| Vagabond | 5 |
| Woodland Alliance | 3 |

Classic 4p (all four) = **25** Reach.

### Standard setup checklist

1. **Assign factions** + random start player / seating. Each takes faction board + pieces listed on its back.
2. Score markers on **0**.
3. **Hands:** 2p → remove all 4 dominance from deck. Shuffle. Each draws **3**.
4. Place **4 ruins** on R slots.
5. **Item supply** on map: `2 boots, 2 bags, 1 crossbow, 1 hammer, 2 swords, 2 tea, 2 coins`.
6. Overview cards + 2 dice near map.
7. In setup letter order (A, B, C…), each faction runs its **Faction Setup**.

---

## Item legend (Vagabond)

| Glyph | Item | Default home |
|---|---|---|
| Boot | Move | Satchel |
| Sword | Battle | Satchel |
| Crossbow | Strike | Satchel |
| Torch | Explore / Special / Aid fuel | Satchel |
| Hammer | Craft / Repair | Satchel |
| Tea | Refresh | Track (max 3) |
| Coin | Card draw | Track (max 3) |
| Bag | Satchel capacity | Track (max 3) |

Undamaged track items (tea/coin/bag) may move freely between track and Satchel while face up.

---

## Marquise de Cat

**Goal feel:** build economy → score by placing buildings (more of same type → more VP). Need wood network.

### Abilities

| Ability | Effect |
|---|---|
| Crafting | Daylight: activate **workshops** |
| The Keep | Only Marquise may **place** pieces in keep clearing (move-in OK). Keep gone forever if removed |
| Field Hospitals | When Marquise warriors removed from a clearing: may spend card matching that clearing → put those warriors on keep clearing instead of supply |

### Setup

1. Supply: **25** warriors, **8** wood.
2. Keep in any **corner** clearing (= starting clearing).
3. Garrison: 1 warrior in every clearing **except** diagonally opposite corner from keep.
4. Place **1 sawmill + 1 workshop + 1 recruiter** in keep clearing and/or adjacent clearings (any split).
5. Remaining 5 of each building type → Buildings tracks right→left (leave leftmost empty).

### Turn

#### Birdsong

Place **1 wood per sawmill** in each clearing that has sawmills.

#### Daylight

1. May craft via workshops.
2. Up to **3 actions**, plus **+1 action per bird spent** (spend not part of an action). Any order/mix:

| Action | Effect |
|---|---|
| Battle | Initiate battle |
| March | Up to **2** moves |
| Recruit | Place 1 warrior at **each** recruiter (**once** per turn) |
| Build | See below |
| Overwork | Spend card matching a sawmill’s clearing → +1 wood there |

**Build**

1. Choose a clearing you **rule**.
2. Choose leftmost sawmill / workshop / recruiter on your board.
3. Pay wood cost (top of column) from: that clearing, adjacent clearings you rule, or any clearing connected through a chain of clearings you rule.
4. Place building; score VP uncovered on track.

**Buildings tracks** (faction board; not in Law prose — from player board)

Six columns left→right. Setup leaves leftmost empty (5 of each building on track). Build takes leftmost building of that type; pay **cost** at top of its column; score **VP** on the uncovered space. Destroyed buildings return to the rightmost empty space.

| Column (L→R) | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Wood cost | 0 | 1 | 2 | 3 | 3 | 4 |
| Sawmill VP | 0 | 1 | 2 | 3 | 4 | 5 |
| Workshop VP | 0 | 2 | 2 | 3 | 4 | 5 |
| Recruiter VP | 0 | 1 | 2 | 3 | 3 | 4 |
| Recruiter draw bonus | — | — | +1 | — | +1 | — |

Evening draw = **1 + uncovered recruiter draw bonuses** (max **3** cards).

#### Evening

Draw 1 + uncovered draw bonuses. Hand > 5 → discard to 5.

---

## Eyrie Dynasties

**Goal feel:** grow roosts → score roosts in Evening. Must obey expanding **Decree** or **turmoil**.

### Abilities

| Ability | Effect |
|---|---|
| Crafting | Daylight **before** Decree: activate **roosts** |
| Lords of the Forest | Win **rule ties** if ≥1 Eyrie piece present |
| Disdain for Trade | Crafted items score **1 VP** instead of printed (extra crafting VP effects still apply) |

### Setup

1. Supply: **20** warriors.
2. Place **1 roost + 6 warriors** in a free corner (prefer diagonal opposite another start).
3. Choose **1 leader**; other leaders face up nearby.
4. Tuck **2 Loyal Viziers** into Decree columns per leader.
5. Remaining **6 roosts** on Roosts track right→left.

**Roosts track** (faction board; not in Law prose — from player board)

Seven spaces for roosts on the map (1–7). Evening: score VP for current roost count. Setup places 1 roost on map + 6 on track. Destroyed roosts return to the rightmost empty track space. Uncovered draw-bonus icons add to Evening draw.

| Roosts on map | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Evening VP | 0 | 1 | 2 | 3 | 4 | 4 | 5 |
| Draw bonus uncovered | — | — | +1 | — | — | +1 | — |

### Leaders

| Leader | Viziers start | Special |
|---|---|---|
| Builder | Recruit, Move | Ignore Disdain for Trade when crafting |
| Charismatic | Recruit, Battle | Recruit places **2** warriors |
| Commander | Move, Battle | As attacker: **+1 hit** |
| Despot | Move, Build | In battle, if you remove ≥1 enemy building/token: **+1 extra VP** |

### Turn

#### Birdsong (order)

1. **Emergency Orders:** hand empty → draw 1.
2. **Add to Decree:** add **1 or 2** cards; **at most one bird**. Any columns; columns unlimited size.
3. **A New Roost:** no roosts on map → place roost + 3 warriors in a legal clearing with fewest warriors.

#### Daylight (order)

1. Craft via roosts.
2. **Resolve Decree** left→right. Within a column, cards any order. For each card, do that column’s action matching card suit:

| Column | Action |
|---|---|
| Recruit | Place 1 warrior in a roost clearing of that suit |
| Move | Move from a clearing of that suit (≥1 warrior) |
| Battle | Battle in a clearing of that suit |
| Build | Place roost in a clearing you rule, of that suit, with no roost |

Cannot fully do an action → **Turmoil** immediately.

#### Evening (order)

1. Score VP on rightmost **empty** Roosts space.
2. Draw 1 + bonuses; discard to 5.

### Turmoil (order)

1. **Humiliate:** −1 VP per bird on Decree (incl. Viziers).
2. **Purge:** discard Decree cards except Loyal Viziers.
3. **Depose:** flip current leader face down; choose new face-up leader; retuck Viziers. No face-up leaders → flip all face up first.
4. **Rest:** end Daylight → begin Evening.

---

## Woodland Alliance

**Goal feel:** spend **supporters** to spread **sympathy** (score) and **revolt** into bases; officers enable military Evening.

### Abilities

| Ability | Effect |
|---|---|
| Crafting | Daylight: activate **sympathy tokens** |
| Guerrilla War | As defender: deal **higher** die; attacker deals **lower** |
| Supporters | Face-down suit-only stack; ignore hand limit; Alliance may peek |
| Supporters capacity | No bases → max **5** (overflow discarded). Any base → unlimited |
| Removing a base | Discard supporters matching base’s printed suit (incl. birds); remove **half officers rounded up**. If no bases left and >5 supporters → discard to 5 |
| Sympathy | Max **1** per clearing. Sympathetic = has token |
| Outrage | See below |

**Outrage** — another player removes a sympathy token **or** moves any warriors into a sympathetic clearing:

1. They must give Alliance **1 hand card** matching affected clearing → Supporters.
2. If they have no matching card (birds count as match): show hand → Alliance draws 1 from deck → Supporters.

### Setup

1. Supply: **10** warriors.
2. 3 bases on matching Bases-box spaces.
3. 10 sympathy on Sympathy track.
4. Draw 3 → Supporters (face down).

**Sympathy track** (faction board; not in Law prose — from player board)

Ten tokens. Spread/Organize pays supporters equal to the **cost** of the next token’s band; scores **VP** uncovered when the token leaves the track.

| Token index (L→R, 0–9) | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Supporter cost | 1 | 1 | 1 | 2 | 2 | 2 | 3 | 3 | 3 | 3 |
| VP | 0 | 1 | 1 | 1 | 2 | 2 | 3 | 4 | 4 | 4 |

### Turn

#### Birdsong (any counts)

**Revolt** (0+ times)

1. Choose sympathetic clearing whose suit matches a base still on your board.
2. Spend **2** supporters of that suit.
3. Remove all enemy pieces there (+VP for buildings/tokens). Place matching base. Place warriors = # sympathetic clearings of that base’s printed suit. Place 1 warrior into **Officers** (now an officer).

**Spread Sympathy** (0+ times)

1. Choose unsympathetic clearing adjacent to a sympathetic one (or any if none sympathetic yet).
2. Spend supporters of target suit equal to cost above next sympathy token.  
   **Martial Law:** +1 matching supporter if target has ≥3 warriors of another player (incl. treated-as-own).
3. Place sympathy; score VP uncovered.

#### Daylight (any order/count)

| Action | Effect |
|---|---|
| Craft | Via sympathy |
| Mobilize | Hand card → Supporters |
| Train | Spend card matching printed suit of a base on map → warrior to Officers |

#### Evening (order)

1. **Military Operations:** up to **# officers** actions (any mix):

   | Op | Effect |
   |---|---|
   | Move | 1 move |
   | Battle | Initiate battle |
   | Recruit | 1 warrior in a base clearing |
   | Organize | Remove 1 Alliance warrior from unsympathetic clearing → place sympathy there → score track VP |

2. Draw 1 + bonuses; discard to 5.

---

## Vagabond

**Goal feel:** manage items; Aid for relationships/VP; quests; fight Hostiles for Infamy; explore ruins.

Pawn is **not** a warrior → does not rule / block rule. Pawn **cannot** be removed.  
**Nimble:** ignore rule requirement when moving.  
**Full removal** effects that clear all enemies: Vagabond instead **damages 3 items**.

### Items

- Exhaust = flip face-up undamaged → face down (then usable again after Refresh / Rest / Repair / Hideout).
- Exhaust tea/coin/bag from track → move that item to Satchel.
- **Max rolled hits** = undamaged swords in Satchel (up or down).
- Take a hit → damage 1 undamaged item → Damaged box. No undamaged left → ignore remaining hits.
- Defenseless if no undamaged swords.

### Dominance / coalitions

Cannot activate dominance for map control win.

In **4+** player games: activate dominance → **coalition** with another player:

- Put your score marker on their board; you stop scoring.
- Target must have fewest VP among others (tie → you choose); cannot already be in a coalition.
- If they win, you win too.
- May coalition a **Hostile** faction → their marker returns to Indifferent.

### Relationships

One marker per non-Vagabond faction: Allied track + Hostile box.

**Improve (non-Hostile):** Aid enough times in one turn (cost printed between spaces). Each Aid counts toward only one step.

When you advance:

- Score VP on new space.
- Final Allied space → **Allied**.

**Relationship track** (faction board; not in Law prose — from player board)

One marker per non-Vagabond faction starts on **Indifferent**. Three steps to **Allied**. Hostile is a separate box (not on this track).

| Step (from Indifferent) | 1 | 2 | 3 (Allied) |
|---|---|---|---|
| Aid cost this turn | 1 | 2 | 3 |
| VP on arrival | 1 | 2 | 2 |

| Status | Effects |
|---|---|
| **Allied** | Aid them → +2 VP. Move: may force their warriors along from origin→destination. Attack: may treat their warriors as yours (max hits = their warriors + your undamaged swords); cannot treat them as yours vs same ally. Hits on treated allies: if more hits taken via removing allies than damaging items → they become Hostile end of battle |
| **Hostile** | Removing their warrior (when not already Hostile) → marker to Hostile; if in battle on your turn → Infamy. Infamy: +1 VP per Hostile piece removed in battle on your turn except the warrior that flipped them Hostile. Move into clearing with any Hostile warriors → **extra boot**. Aid still OK for crafted items but won’t leave Hostile. |

### Setup

1. Choose character → Character slot.
2. Pawn in any **forest**.
3. Shuffle quests; draw **3** face up.
4. Under each ruin: shuffle one of `bag, boot, hammer, sword` marked **R**; return stacks to R slots.
5. Take starting items marked **S** on character; tea/coin/bag → tracks; others → Satchel face up. Spare S items to box.
6. Relationship markers for each other faction → **Indifferent**.

### Turn

#### Birdsong (order)

1. **Refresh:** flip face-up **2 × (face-up tea)** exhausted items, then **+3** more.
2. **Slip (optional):** move to adjacent clearing or forest **free** (no boots), even into Hostile; ignores effects that block leaving a clearing.

#### Daylight

Exhaust items for actions (any order/count):

| Action | Cost | Effect |
|---|---|---|
| Move | 1 boot (+1 if dest has Hostile warriors) | No move into forest. From forest → only to adjacent clearing |
| Battle | 1 sword | Check relationships |
| Explore | 1 torch | Take 1 item under ruin here → Satchel/track; +1 VP; last item removes ruin |
| Aid | any 1 item | Give 1 card matching your clearing to a player with pieces here; may take 1 item from their Crafted Items |
| Quest | 2 items on quest | Quest suit must match clearing; complete → draw replacement; score 1 VP per completed quest of that suit **or** draw 2 cards |
| Strike | 1 crossbow | Remove 1 enemy warrior here (else their other piece if no warriors). Check relationships |
| Repair | 1 hammer | Move 1 damaged item to Satchel/track (keep face) |
| Craft | hammers = cost suits | All hammers match **your clearing** suit; crafted item may go Satchel/track face up |
| Special | 1 torch | Character ability |

#### Evening (order)

1. **Rest:** if in forest → all Damaged items → Satchel/track, face up.
2. **Draw:** 1 + face-up coins on track.
3. **Discard** to 5.
4. **Capacity:** Satchel + Damaged may hold at most `6 + 2×(face-up bags)`. Excess → remove from game permanently.

### Characters (base)

| Character | Starting items | Special (exhaust torch) |
|---|---|---|
| **Thief** | boot, torch, tea, sword | **Steal:** take 1 random card from any player in your clearing |
| **Tinker** | boot, torch, bag, hammer | **Day Labor:** take 1 discard card matching your clearing (bird always OK) |
| **Ranger** | boot, torch, crossbow, sword | **Hideout:** repair 3 items; then end Daylight → Evening |

---

## Quick reference — hand limit & draws

Unless a faction says otherwise:

- Evening: draw **1 + uncovered draw bonuses**, then hand max **5**.
- Supporters (Alliance) and activated dominance do not count toward hand limit.
