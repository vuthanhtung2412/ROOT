# Rootbotics — Difficulty and Trait cards (Mechanical Marquise 2.0, Electric Eyrie, Automated Alliance, Vagabot)

Card text transcribed from the card scans in `rootbotics-cards/`
(source: The Root Database, `therootdatabase.com/post/<bot>/en/decks/{difficulty,traits}/`).
Setup use: Law of Rootbotics 3.3 (`Law_of_Rootbotics.md`). No difficulty card = default.

## Mechanical Marquise 2.0

### Difficulty
- **Easy** — Recruit two warriors during the recruit action.
- **Challenging** — After recruiting, place two warriors in the highest priority clearing you rule matching the order card.
- **Nightmare** — After recruiting, place two warriors in the highest priority clearing you rule matching the order card. At the end of evening, score 1 VP.

### Traits
- **Blitz** — After your move action select the highest priority clearing you rule without any enemy pieces. Move all but one warrior from the clearing and battle in the destination if opponents are present.
- **Fortified** — Opponents require two hits to destroy each of your buildings. Assigning a single hit to a building has no effect.
- **Hospitals** — After each battle as Defender in which you lost at least 2 warriors, immediately recruit 2 warriors in the clearing with the keep token.
- **Iron Will** — In Escalated Daylight recruit twice as many warriors.
- **Overwhelming** — Whenever you Recruit, score one point for every two warriors you cannot place because your supply is empty or because there are no legal clearings to place them in. Expand can only trigger once per turn.

## Electric Eyrie

### Difficulty
- **Easy** — During setup, place only one Loyal Vizier in the bird column.
- **Challenging** — During setup, take out one bird ambush from the deck and place in in the bird column.
- **Nightmare** — During setup, take out one bird ambush from the deck and place in in the bird column. At the end of evening, score 1 VP.

### Traits
- **Focused** — In battle, deal the extra hit even if the Battle column is tied for most cards.
- **Nobility** — Turmoil is now triggered if you are unable to place a roost or if you are unable to place a warrior. When turmoil occurs, no victory points are lost and instead a point is scored for every bird card in your Decree.
- **Relentless** — After resolving the Decree, remove all defenseless buildings and tokens in any clearing where you have warriors.
- **Swoop** — At the end of Daylight, recruit two warriors in the highest priority clearing in which you have no pieces.
- **War Tax** — Whenever you destroy a token or building, the owner loses 1 VP.

## Automated Alliance

Faction board scan: `rootbotics-cards/automated-alliance-board.webp`.
Sympathy track (left → right, VP when the token is placed): 0, +1, +1, +1, +1, +2, +2, +3, +3, +4.

### Difficulty
- **Easy** — Organize if there are 4 or more warriors in the clearing.
- **Challenging** — Organize if there are 2 or more warriors in the clearing.
- **Nightmare** — Organize if there are 2 or more warriors in the clearing. At the end of evening, score 1 VP.

### Traits
- **Steadfast** — Skip Public Pity if Surprise Revolt will happen this turn. (Take only one of these actions each turn.) Ignore Martial Law.
- **Wildfire** — At the end of evening, Spread Sympathy. Do not score points for placing this sympathy token.
- **Informants** — Defenseless sympathy tokens benefit from Automated Ambush when attacked.
- **Popularity** — Destroying sympathy tokens grants no victory points for your opponents.
- **Veterans** — In battle as defender, you use the higher roll and the attacker uses the lower roll.

## Vagabot

Faction board scan: `rootbotics-cards/vagabot-board.webp`.
Daylight Actions (by order card suit, left → right):
- **Fox** — Explore, Battle, Special
- **Rabbit** — Battle, Repair, Special
- **Mouse** — Quest, Aid, Battle, Repair
- **Bird** — Explore, Quest, Aid, Battle

Evening (board): 1st if you have any damaged items, refresh four undamaged items; if you have none, refresh six instead. 2nd if you are in a forest, repair all items; if not, repair one item (unexhausted before exhausted). 3rd discard the order card.

### Difficulty
- **Easy** — Refresh one less item during Evening.
- **Challenging** — Refresh one more item during Evening.
- **Nightmare** — Refresh one more item during Evening. At the end of evening, score 1 VP.

### Traits
- **Adventurer** — Battle only once per turn. At the end of Daylight, spend any remaining items on repeated Quest actions.
- **Berserker** — During the Battle action target the clearing with the most pieces and target the player with the most pieces in that clearing. At the end of your turn, repair one addition item.
- **Marksman** — When attacking, deal one immediate hit to your opponent (scoring a point if a warrior is removed) before the dice are rolled.
- **Helper** — When taking the Aid action, score an additional victory point. The aided player then takes two cards instead of one.
- **Questing** — Count damaged items toward the 6/9/12 items needed to place items on your Battle Track. Items cannot be removed from the Battle Track. Quests score an extra victory point. Whenever you Aid, move to the nearest clearing that has a player with any items in their Crafted Items box, but only aid them once. Use these updated Daylight actions: Fox — Explore, Special, Battle; Rabbit — Special, Aid, Battle; Mouse — Quest, Aid, Battle; Bird — Explore, Quest, Battle.

### Characters
- **Thief** (Steal) — Take a random card from an enemy player in your clearing. Target is highest score, then most pieces.
- **Tinker** (Day Labor) — Search the discard pile for the topmost card with an available item, and craft it, scoring +1. Start the game with one less item.
- **Ranger** (Hideout) — If you have three or more damaged items, slip into a random adjacent forest.
- **Vagrant** — Initiate a battle in your clearing. You choose the attacker then the defender (using setup priority), and you remove pieces for each.
- **Scoundrel** — If your clearing has three or more enemy pieces and a building or token, remove all enemy pieces there, place any item from your board on a building slot there, and score one point. Buildings cannot be placed in the covered slot.
- **Arbiter** — Before rolling in battle, the defender may enlist you if you're in the battle clearing. If so, you score a point and add the number of items on your Battle Track to their maximum rolled hits. Bots will enlist you if their maximum rolled hits is less than three, their maximum hits is less than the attacker's pieces there, and you have fewer points than the defender.
