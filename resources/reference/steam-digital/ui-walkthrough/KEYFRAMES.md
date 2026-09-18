# Root Digital — key UI frames

Hand-reviewed keepers from the walkthrough pack. See [`SOURCES.md`](./SOURCES.md) for video origin.

## Faction boards

+ [x] [`t0990s.jpg`](./t0990s.jpg) : Tinker Vagabond board — satchel, item slots (damaged/exhausted), relationships. Shows how item state is rendered.
+ [x] [`t1160s.jpg`](./t1160s.jpg) : Woodland Alliance board — Guerrilla War / Outrage text, sympathy track VP values, supporter stack, officers.

## Battle

+ [x] [`t1610s.jpg`](./t1610s.jpg) : Battle result overlay — VS, two dice, hits per side, modifier line ("Brutal Tactics −1"). Direct spec for rendering `BattleResolved`.
+ [x] [`t1640s.jpg`](./t1640s.jpg) : Battle with card art floating in center — how played battle cards (Ambush / Armorers) are shown.
+ [x] [`t2430s.jpg`](./t2430s.jpg) : "Choose ambush cards." picker with **Skip** — exact shape of our multi-seat `pending` prompt (bluff-able).

## Prompts and pickers

+ [x] [`t0020s.jpg`](./t0020s.jpg) : "Choose a clearing for your keep." — dashed rings on valid clearings; canonical valid-target highlight.
+ [x] [`t0060s.jpg`](./t0060s.jpg) : "Choose where to build your sawmill." — same highlight pattern during setup chain.
+ [x] [`t0790s.jpg`](./t0790s.jpg) : Move count widget — "1/3 ➕ / March" popup anchored to source clearing, ▶ confirm on destination. Model for warrior count picker.
+ [x] [`t1320s.jpg`](./t1320s.jpg) : "Select warriors to move." + warrior tooltip + red ✕ cancel — cancel affordance placement.
+ [x] [`t1020s.jpg`](./t1020s.jpg) : "Choose an action." — Marquise daylight action grid (Move / Craft / Overwork / Battle / Recruit / Build).
+ [x] [`t0780s.jpg`](./t0780s.jpg) : Build action tooltip + green valid clearing — tooltip style for action icons.
+ [x] [`t1260s.jpg`](./t1260s.jpg) : "Discard a matching card for Field Hospital" — cost-payment prompt over hand.
+ [x] [`t0090s.jpg`](./t0090s.jpg) : "Move Decree!" card overlay — Eyrie adding a card to the decree.

## Cards

+ [x] [`t1590s.jpg`](./t1590s.jpg) : DISCARD PILE modal — horizontal card list, ◀ ▶, Close. Reusable card-list modal (hand inspect, log).

## Turn flow and chrome

+ [x] [`t0240s.jpg`](./t0240s.jpg) : Spectator banner — "Eyrie is choosing a clearing to march from." Passive-seat copy + zoomed clearing tokens.
+ [x] [`t2200s.jpg`](./t2200s.jpg) : Spectator banner — "Woodland Alliance is considering a revolt."
+ [x] [`t2160s.jpg`](./t2160s.jpg) : Modal "The Eyrie have entered Turmoil" with −5 VP reason line — blocking event modal.
+ [x] [`t2040s.jpg`](./t2040s.jpg) : "Vagabond is choosing cards to discard." with map dimmed — evening discard-to-hand-limit state.

## Game end

+ [x] [`t2880s.jpg`](./t2880s.jpg) : End result bar — winner name, faction chips, Close.
