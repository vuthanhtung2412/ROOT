import type { ActionSpec } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { matchesSuit } from '#cards/suit.js'
import {
  boardOf,
  pawnClearing,
} from '#factions/vagabond/items.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { ItemType, Seat } from '#pieces/types.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { playerOf } from '#queries/seat.js'
import type { VagabondBoard } from '#state/boards.js'
import type { GameState } from '#state/types.js'

export function hasExhaustible(board: VagabondBoard, type: ItemType): boolean {
  return (
    board.satchel.some((item) => item.type === type && !item.exhausted) ||
    board.tracks.tea.some((item) => item.type === type && !item.exhausted) ||
    board.tracks.coin.some((item) => item.type === type && !item.exhausted) ||
    board.tracks.bag.some((item) => item.type === type && !item.exhausted)
  )
}

export function hasAnyExhaustible(board: VagabondBoard): boolean {
  return (
    board.satchel.some((item) => !item.exhausted) ||
    board.tracks.tea.some((item) => !item.exhausted) ||
    board.tracks.coin.some((item) => !item.exhausted) ||
    board.tracks.bag.some((item) => !item.exhausted)
  )
}

export function undamagedHammerCount(board: VagabondBoard): number {
  return [
    ...board.satchel,
    ...board.tracks.tea,
    ...board.tracks.coin,
    ...board.tracks.bag,
  ].filter((item) => item.type === 'hammer' && !item.exhausted).length
}

export function destinationHasHostile(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
): boolean {
  const board = boardOf(state, seat)
  for (const player of state.players) {
    if (player.seat === seat) continue
    const relation = board.relationships[player.faction]
    if (relation !== 'hostile') continue
    if (
      state.clearings[clearing]?.pieces.some(
        (piece) => piece.kind === 'warrior' && piece.owner === player.seat,
      )
    ) {
      return true
    }
  }
  return false
}

export function slipDestinations(
  state: GameState,
  seat: Seat,
  board: VagabondBoard,
): { clearings: ClearingId[]; forests: number[] } {
  const clearings: ClearingId[] = []
  const forests: number[] = []
  if (board.forest !== null) {
    for (const adjacent of FALL.forests[board.forest] ?? []) {
      clearings.push(adjacent)
    }
    return { clearings, forests }
  }
  const clearing = pawnClearing(state, seat)
  if (clearing === null) return { clearings, forests }
  for (const to of FALL.adjacent(clearing)) {
    clearings.push(to)
  }
  FALL.forests.forEach((border, forestIndex) => {
    if (border.includes(clearing)) {
      forests.push(forestIndex)
    }
  })
  return { clearings, forests }
}

export function canCraftWithHammers(
  state: GameState,
  seat: Seat,
  card: Card,
): boolean {
  const def = defOf(card)
  if (def.type !== 'item' && def.type !== 'persistent' && def.type !== 'partisan') {
    return false
  }
  if (def.cost.length === 0) return false
  const board = boardOf(state, seat)
  if (undamagedHammerCount(board) < def.cost.length) return false
  if (def.type === 'item') {
    if (def.item === undefined) return false
    if ((state.itemSupply[def.item] ?? 0) < 1) return false
  }
  return true
}

export function pushDaylightActions(
  state: GameState,
  seat: Seat,
  board: VagabondBoard,
  specs: ActionSpec[],
): void {
  // From forest: only Move to adjacent clearings.
  if (board.forest !== null) {
    if (hasExhaustible(board, 'boot')) {
      const destinations = FALL.forests[board.forest] ?? []
      if (destinations.length > 0) {
        specs.push({
          type: 'vbMove',
          actor: seat,
          params: { clearings: [...destinations] },
        })
      }
    }
    return
  }

  const clearing = pawnClearing(state, seat)
  if (clearing === null) return

  if (hasExhaustible(board, 'boot')) {
    const destinations: ClearingId[] = []
    for (const to of FALL.adjacent(clearing)) {
      const needsExtraBoot = destinationHasHostile(state, seat, to)
      if (needsExtraBoot) {
        const boots = [
          ...board.satchel,
          ...board.tracks.tea,
          ...board.tracks.coin,
          ...board.tracks.bag,
        ].filter((item) => item.type === 'boot' && !item.exhausted).length
        if (boots < 2) continue
      }
      destinations.push(to)
    }
    if (destinations.length > 0) {
      specs.push({
        type: 'vbMove',
        actor: seat,
        params: { clearings: destinations },
      })
    }
  }

  if (hasExhaustible(board, 'sword')) {
    for (const defender of enemySeatsInClearing(state, clearing, seat)) {
      specs.push({
        type: 'vbBattle',
        actor: seat,
        params: { targets: [{ clearing, defender }] },
      })
    }
  }

  if (hasExhaustible(board, 'torch') && state.clearings[clearing]?.ruin !== undefined) {
    specs.push({ type: 'explore', actor: seat })
  }

  if (hasAnyExhaustible(board)) {
    for (const player of state.players) {
      if (player.seat === seat) continue
      const hasPieces = state.clearings[clearing]!.pieces.some(
        (piece) => piece.owner === player.seat,
      )
      if (!hasPieces) continue
      const suit = FALL.clearings[clearing]!.suit
      const cardIds = playerOf(state, seat)
        .hand.filter((card) => matchesSuit(card, suit))
        .map((card) => card.id)
      if (cardIds.length === 0) continue
      specs.push({
        type: 'aid',
        actor: seat,
        params: { cardIds, defender: [player.seat] },
      })
    }
  }

  if (hasExhaustible(board, 'crossbow')) {
    for (const defender of enemySeatsInClearing(state, clearing, seat)) {
      specs.push({
        type: 'strike',
        actor: seat,
        params: { targets: [{ clearing, defender }] },
      })
    }
  }

  if (hasExhaustible(board, 'hammer') && board.damaged.length > 0) {
    specs.push({
      type: 'repair',
      actor: seat,
      params: {
        clearings: board.damaged.map((_, index) => index),
      },
    })
  }

  const craftIds = playerOf(state, seat)
    .hand.filter((card) => canCraftWithHammers(state, seat, card))
    .map((card) => card.id)
  if (craftIds.length > 0) {
    specs.push({
      type: 'vbCraft',
      actor: seat,
      params: { cardIds: craftIds },
    })
  }

  if (hasExhaustible(board, 'torch')) {
    for (const player of state.players) {
      if (player.seat === seat) continue
      if (player.hand.length === 0) continue
      const hasPieces = state.clearings[clearing]!.pieces.some(
        (piece) => piece.owner === player.seat,
      )
      if (!hasPieces) continue
      specs.push({
        type: 'steal',
        actor: seat,
        params: { defender: [player.seat] },
      })
    }
  }
}
