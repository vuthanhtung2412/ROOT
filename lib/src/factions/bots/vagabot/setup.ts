import { QUEST_DECK, type QuestCard } from '#cards/quests.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { shuffleWithRng } from '#game/setup.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { ItemType, Seat } from '#pieces/types.js'
import {
  DEFAULT_VAGABOT_CHARACTER,
  type VagabotCharacter,
} from '#public/botSettings.js'
import { randomIndex, type Rng } from '#rules/Rng.js'
import { VAGABOND_START_ITEMS } from '#state/boards.js'
import type { VagabotItem } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 7.3.5 — four starting items. */
const STARTING_ITEM_COUNT = 4
/** Rule: Rootbotics 7.7.2 — the Tinker starts with one fewer item. */
const TINKER_STARTING_ITEM_COUNT = 3

/** Rule: Rootbotics 7.3.1 — the character card chosen for the Vagabot. */
export function vagabotCharacterSetting(state: GameState): VagabotCharacter {
  return state.botSettings?.vagabot?.character ?? DEFAULT_VAGABOT_CHARACTER
}

/** Forest indexes adjacent to the most clearings (Rootbotics 7.3.2). */
export function forestsAdjacentToMostClearings(): number[] {
  const mostClearings = Math.max(
    ...FALL.forests.map((border: ClearingId[]): number => border.length),
  )
  return FALL.forests
    .map((border: ClearingId[], forest: number): { forest: number; size: number } => ({
      forest,
      size: border.length,
    }))
    .filter((entry: { forest: number; size: number }): boolean => entry.size === mostClearings)
    .map((entry: { forest: number; size: number }): number => entry.forest)
}

function startingItems(character: VagabotCharacter): VagabotItem[] {
  const count = character === 'tinker' ? TINKER_STARTING_ITEM_COUNT : STARTING_ITEM_COUNT
  return VAGABOND_START_ITEMS[character]
    .slice(0, count)
    .map(
      (type: ItemType): VagabotItem => ({
        type,
        exhausted: false,
        damaged: false,
        onBattleTrack: false,
      }),
    )
}

/** Rule: Rootbotics 7.3.3 — draw one quest from the shuffled quest deck. */
export function drawVagabotQuest(state: GameState, rng: Rng): QuestCard | null {
  if (state.questDeck.length === 0 && state.questsAvailable.length === 0) {
    state.questDeck = shuffleWithRng([...QUEST_DECK], rng)
  }
  return state.questDeck.pop() ?? null
}

/** Rule: Rootbotics 7.3 — character, pawn in a forest, a quest, starting items. */
export function placeVagabotSetup(state: GameState, seat: Seat, rng: Rng): void {
  const board = vagabotBoardOf(state, seat)
  const character = vagabotCharacterSetting(state)
  const forests = forestsAdjacentToMostClearings()
  board.character = character
  board.forest = forests[randomIndex(rng, forests.length)] ?? FALL.vagabondForest
  board.quest = drawVagabotQuest(state, rng)
  // Rule: Rootbotics 7.3.4 — the ruins are populated at game setup.
  board.items = startingItems(character)
}
