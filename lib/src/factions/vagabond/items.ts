import type { VagabondItemChoice } from '#actions/types.js'
import type { ItemType, Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import type { VagabondBoard, VagabondItem } from '#state/boards.js'
import { VAGABOND_TRACK_ITEM_CAP } from '#state/boards.js'
import type { GameState } from '#state/types.js'
import { RuleError } from '#rules/RuleError.js'

export function boardOf(state: GameState, seat: Seat): VagabondBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'vagabond') {
    throw new RuleError('NOT_VAGABOND', { seat })
  }
  return board
}

export function allUndamagedItems(board: VagabondBoard): VagabondItem[] {
  return [
    ...board.satchel,
    ...board.tracks.tea,
    ...board.tracks.coin,
    ...board.tracks.bag,
  ]
}

export function undamagedSwords(board: VagabondBoard): number {
  return allUndamagedItems(board).filter((item) => item.type === 'sword').length
}

export function faceUpTeaCount(board: VagabondBoard): number {
  return board.tracks.tea.filter((item) => !item.exhausted).length
}

export function faceUpCoinCount(board: VagabondBoard): number {
  return board.tracks.coin.filter((item) => !item.exhausted).length
}

export function faceUpBagCount(board: VagabondBoard): number {
  return board.tracks.bag.filter((item) => !item.exhausted).length
}

export function satchelCapacity(board: VagabondBoard): number {
  // Rule: Vagabond Evening — 6 + 2× face-up bags.
  return 6 + 2 * faceUpBagCount(board)
}

/** Exhaust one undamaged matching item (track → satchel if tea/coin/bag). */
export function exhaustItem(
  board: VagabondBoard,
  type: ItemType,
): VagabondItem | null {
  for (const trackKey of ['tea', 'coin', 'bag'] as const) {
    const track = board.tracks[trackKey]
    const index = track.findIndex(
      (item) => item.type === type && !item.exhausted,
    )
    if (index >= 0) {
      const [item] = track.splice(index, 1)
      if (item === undefined) return null
      item.exhausted = true
      board.satchel.push(item)
      return item
    }
  }
  const satchelIndex = board.satchel.findIndex(
    (item) => item.type === type && !item.exhausted,
  )
  if (satchelIndex < 0) return null
  const item = board.satchel[satchelIndex]!
  item.exhausted = true
  return item
}

export function refreshItems(board: VagabondBoard, count: number): number {
  let refreshed = 0
  const pools = [
    board.satchel,
    board.tracks.tea,
    board.tracks.coin,
    board.tracks.bag,
    // Rule: 9.4.1 Refresh — damaged items can be exhausted and are refreshed too.
    board.damaged,
  ]
  for (const pool of pools) {
    for (const item of pool) {
      if (refreshed >= count) return refreshed
      if (item.exhausted) {
        item.exhausted = false
        refreshed += 1
      }
    }
  }
  return refreshed
}

export function damageItems(board: VagabondBoard, count: number): number {
  let damaged = 0
  while (damaged < count) {
    const undamaged = allUndamagedItems(board)
    if (undamaged.length === 0) break
    const item = undamaged[0]!
    removeItemFromBoard(board, item)
    board.damaged.push({ type: item.type, exhausted: item.exhausted })
    damaged += 1
  }
  return damaged
}

/** Number of items a hit count actually damages (hits beyond undamaged items are ignored). */
export function damageableItemCount(board: VagabondBoard, count: number): number {
  return Math.max(0, Math.min(count, allUndamagedItems(board).length))
}

/** Rule: 9.2.6 — the Vagabond chooses only when some undamaged items survive. */
export function isItemDamageChoiceRequired(
  board: VagabondBoard,
  count: number,
): boolean {
  return count > 0 && count < allUndamagedItems(board).length
}

export function undamagedItemChoices(board: VagabondBoard): VagabondItemChoice[] {
  return allUndamagedItems(board).map(
    (item: VagabondItem): VagabondItemChoice => ({
      type: item.type,
      exhausted: item.exhausted,
    }),
  )
}

function findUndamagedItem(
  candidates: readonly VagabondItem[],
  choice: VagabondItemChoice,
): VagabondItem | undefined {
  return candidates.find(
    (item: VagabondItem): boolean =>
      item.type === choice.type && item.exhausted === choice.exhausted,
  )
}

/** True when `choices` names exactly `count` distinct undamaged items. */
export function isValidItemDamageChoice(
  board: VagabondBoard,
  choices: readonly VagabondItemChoice[],
  count: number,
): boolean {
  if (choices.length !== damageableItemCount(board, count)) return false
  let remaining: VagabondItem[] = allUndamagedItems(board)
  for (const choice of choices) {
    const match = findUndamagedItem(remaining, choice)
    if (match === undefined) return false
    remaining = remaining.filter((item: VagabondItem): boolean => item !== match)
  }
  return true
}

/** Rule: 9.2.6 — move the chosen undamaged items to the Damaged box. */
export function damageChosenItems(
  board: VagabondBoard,
  choices: readonly VagabondItemChoice[],
): void {
  for (const choice of choices) {
    const item = findUndamagedItem(allUndamagedItems(board), choice)
    if (item === undefined) {
      throw new RuleError('INVALID_ITEM_DAMAGE_CHOICE', { choice })
    }
    removeItemFromBoard(board, item)
    board.damaged.push({ type: item.type, exhausted: item.exhausted })
  }
}

function removeItemFromBoard(board: VagabondBoard, target: VagabondItem): void {
  const satchelIndex = board.satchel.indexOf(target)
  if (satchelIndex >= 0) {
    board.satchel.splice(satchelIndex, 1)
    return
  }
  for (const trackKey of ['tea', 'coin', 'bag'] as const) {
    const track = board.tracks[trackKey]
    const index = track.indexOf(target)
    if (index >= 0) {
      track.splice(index, 1)
      return
    }
  }
}

export function placeItemInSatchelOrTrack(
  board: VagabondBoard,
  type: ItemType,
): void {
  const item: VagabondItem = { type, exhausted: false }
  if (type === 'tea' || type === 'coin' || type === 'bag') {
    if (board.tracks[type].length < VAGABOND_TRACK_ITEM_CAP) {
      board.tracks[type].push(item)
      return
    }
  }
  board.satchel.push(item)
}

/** Rule: 9.5.7 Repair — restore damaged item, keep current face (exhausted or not). */
export function restoreRepairedItem(board: VagabondBoard, item: VagabondItem): void {
  const restored: VagabondItem = { type: item.type, exhausted: item.exhausted }
  if (
    (restored.type === 'tea' ||
      restored.type === 'coin' ||
      restored.type === 'bag') &&
    !restored.exhausted &&
    board.tracks[restored.type].length < VAGABOND_TRACK_ITEM_CAP
  ) {
    board.tracks[restored.type].push(restored)
    return
  }
  board.satchel.push(restored)
}

export function pawnClearing(state: GameState, seat: Seat): number | null {
  const board = boardOf(state, seat)
  if (board.forest !== null) return null
  for (let clearing = 0; clearing < state.clearings.length; clearing++) {
    if (
      state.clearings[clearing]?.pieces.some(
        (piece) => piece.kind === 'pawn' && piece.owner === seat,
      )
    ) {
      return clearing
    }
  }
  return null
}
