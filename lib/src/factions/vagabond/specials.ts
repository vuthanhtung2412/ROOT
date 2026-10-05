import type { VagabondItemChoice } from '#actions/types.js'
import { matchesSuit } from '#cards/suit.js'
import type { Card } from '#cards/types.js'
import {
  boardOf,
  exhaustItem,
  pawnClearing,
  restoreRepairedItem,
} from '#factions/vagabond/items.js'
import { FALL } from '#map/fall.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import {
  DEFAULT_VAGABOND_CHARACTER,
  HIDEOUT_REPAIR_COUNT,
} from '#state/boards.js'
import type {
  VagabondBoard,
  VagabondCharacter,
  VagabondItem,
} from '#state/boards.js'
import type { GameState } from '#state/types.js'

/** Character whose special action the board may take. */
export function vagabondCharacterOf(board: VagabondBoard): VagabondCharacter {
  return board.character ?? DEFAULT_VAGABOND_CHARACTER
}

/** Rule: D.2.2 Day Labor — discard-pile cards matching the clearing (bird always). */
export function dayLaborCards(state: GameState, clearing: number): Card[] {
  const clearingSuit = FALL.clearings[clearing]!.suit
  return state.deck.discard.filter((card: Card): boolean =>
    matchesSuit(card, clearingSuit),
  )
}

/** Rule: D.2.2 Day Labor — exhaust a torch, take the chosen discard card. */
export function applyDayLabor(
  state: GameState,
  seat: Seat,
  cardId: string,
): void {
  const clearing = pawnClearing(state, seat)
  if (clearing === null) throw new RuleError('NOT_IN_CLEARING')
  const card = dayLaborCards(state, clearing).find(
    (candidate: Card): boolean => candidate.id === cardId,
  )
  if (card === undefined) throw new RuleError('NO_DAY_LABOR_CARD', { cardId })
  if (exhaustItem(boardOf(state, seat), 'torch') === null) {
    throw new RuleError('NO_TORCH')
  }
  state.deck.discard = state.deck.discard.filter(
    (candidate: Card): boolean => candidate.id !== cardId,
  )
  playerOf(state, seat).hand.push(card)
}

/** Rule: D.3.2 Hideout — damaged items the Ranger may repair. */
export function hideoutItemChoices(board: VagabondBoard): VagabondItemChoice[] {
  return board.damaged.map(
    (item: VagabondItem): VagabondItemChoice => ({
      type: item.type,
      exhausted: item.exhausted,
      damaged: true,
    }),
  )
}

/** Rule: D.3.2 Hideout — repair three items, or all when fewer are damaged. */
export function hideoutRepairCount(board: VagabondBoard): number {
  return Math.min(HIDEOUT_REPAIR_COUNT, board.damaged.length)
}

function chosenDamagedItems(
  board: VagabondBoard,
  choices: readonly VagabondItemChoice[],
): VagabondItem[] | null {
  if (choices.length !== hideoutRepairCount(board)) return null
  const chosen: VagabondItem[] = []
  for (const choice of choices) {
    const match = board.damaged.find(
      (item: VagabondItem): boolean =>
        !chosen.includes(item) &&
        item.type === choice.type &&
        item.exhausted === choice.exhausted,
    )
    if (match === undefined) return null
    chosen.push(match)
  }
  return chosen
}

/**
 * Rule: D.3.2 Hideout — exhaust a torch, repair the chosen items. The caller
 * then ends Daylight.
 */
export function applyHideout(
  board: VagabondBoard,
  choices: readonly VagabondItemChoice[],
): void {
  const chosen = chosenDamagedItems(board, choices)
  if (chosen === null) throw new RuleError('INVALID_HIDEOUT_ITEMS', { choices })
  if (exhaustItem(board, 'torch') === null) throw new RuleError('NO_TORCH')
  board.damaged = board.damaged.filter(
    (item: VagabondItem): boolean => !chosen.includes(item),
  )
  for (const item of chosen) {
    restoreRepairedItem(board, item)
  }
}
