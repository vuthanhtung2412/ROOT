import type { ActionSpec, VagabondMoveChoice } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import { questDefOf } from '#cards/quests.js'
import type { Card } from '#cards/types.js'
import { matchesSuit } from '#cards/suit.js'
import { alliedWarriorSeatsInClearing } from '#factions/vagabond/allied.js'
import {
  boardOf,
  pawnClearing,
} from '#factions/vagabond/items.js'
import {
  dayLaborCards,
  hideoutItemChoices,
  hideoutRepairCount,
  vagabondCharacterOf,
} from '#factions/vagabond/specials.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { ItemType, Seat } from '#pieces/types.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { warriors } from '#queries/pieces.js'
import { moveNeighbors } from '#queries/rivers.js'
import { playerOf } from '#queries/seat.js'
import {
  VAGABOND_TRACK_ITEM_CAP,
  type VagabondBoard,
} from '#state/boards.js'
import type { GameState } from '#state/types.js'
import { hasCardToTake } from '#factions/bots/manualDexterity.js'

/** Craft cost any crafting piece pays, whatever its suit. */
const WILD_COST_SUIT = 'wild'

export function hasExhaustible(board: VagabondBoard, type: ItemType): boolean {
  return exhaustibleCount(board, type) > 0
}

export function exhaustibleCount(board: VagabondBoard, type: ItemType): number {
  return [
    ...board.satchel,
    ...board.tracks.tea,
    ...board.tracks.coin,
    ...board.tracks.bag,
  ].filter((item) => item.type === type && !item.exhausted).length
}

/** Distinct types of face-up undamaged items, in board order. */
export function exhaustibleItemTypes(board: VagabondBoard): ItemType[] {
  const types: ItemType[] = [
    ...board.satchel,
    ...board.tracks.tea,
    ...board.tracks.coin,
    ...board.tracks.bag,
  ]
    .filter((item) => !item.exhausted)
    .map((item): ItemType => item.type)
  return [...new Set(types)]
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
  // Rule: Vagabond > Birdsong > Slip (9.4.2) — adjacent clearing or forest.
  if (board.forest !== null) {
    for (const adjacent of FALL.forests[board.forest] ?? []) {
      clearings.push(adjacent)
    }
    for (const adjacentForest of FALL.adjacentForests(board.forest)) {
      forests.push(adjacentForest)
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
  // Rule: 9.5.8 — all hammers match the suit of the Vagabond's clearing.
  const clearing = pawnClearing(state, seat)
  if (clearing === null) return false
  const hammerSuit = FALL.clearings[clearing]!.suit
  if (!def.cost.every((need) => need === WILD_COST_SUIT || need === hammerSuit)) {
    return false
  }
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
    const vbMoves: VagabondMoveChoice[] = []
    for (const to of moveNeighbors(state, seat, clearing)) {
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
      vbMoves.push({ to })
      // Rule: 9.2.9.IIb — may force Allied warriors along from origin.
      for (const allySeat of alliedWarriorSeatsInClearing(state, seat, clearing)) {
        const available = warriors(state, clearing, allySeat)
        for (let allyCount = 1; allyCount <= available; allyCount++) {
          vbMoves.push({ to, allySeat, allyCount })
        }
      }
    }
    if (vbMoves.length > 0) {
      specs.push({
        type: 'vbMove',
        actor: seat,
        params: {
          clearings: [...new Set(vbMoves.map((move) => move.to))],
          vbMoves,
        },
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
      // Rule: 9.2.9.IIc — may treat one Allied faction's warriors as own.
      for (const alliedSeat of alliedWarriorSeatsInClearing(state, seat, clearing)) {
        if (alliedSeat === defender) continue
        specs.push({
          type: 'vbBattle',
          actor: seat,
          params: {
            targets: [{ clearing, defender }],
            alliedSeat: [alliedSeat],
          },
        })
      }
    }
  }

  if (hasExhaustible(board, 'torch') && state.clearings[clearing]?.ruin !== undefined) {
    specs.push({ type: 'explore', actor: seat })
  }

  // Rule: Vagabond > Quest 9.5.5 — suit match + exhaust listed items.
  {
    const clearingSuit = FALL.clearings[clearing]!.suit
    const questIds: string[] = []
    for (const quest of state.questsAvailable) {
      const definition = questDefOf(quest)
      if (definition.suit !== clearingSuit) continue
      const [firstItem, secondItem] = definition.items
      if (firstItem === secondItem) {
        if (exhaustibleCount(board, firstItem) < 2) continue
      } else if (
        !hasExhaustible(board, firstItem) ||
        !hasExhaustible(board, secondItem)
      ) {
        continue
      }
      questIds.push(quest.id)
    }
    if (questIds.length > 0) {
      specs.push({
        type: 'quest',
        actor: seat,
        params: { questIds, rewards: ['vp', 'draw'] },
      })
    }
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
        params: {
          cardIds,
          defender: [player.seat],
          costItemTypes: exhaustibleItemTypes(board),
          // Rule: 9.5.6 Aid — may take one item from the target's Crafted Items box.
          // Paired with the target so merged specs keep each seat's own items.
          aidTakeOptions: [
            {
              target: player.seat,
              itemTypes: [
                ...new Set(
                  player.craftedItems.map((item): ItemType => item.type),
                ),
              ],
            },
          ],
        },
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
        // Same order as `clearings` indexes, so the UI can name each item.
        vagabondItems: board.damaged.map((item) => ({
          type: item.type,
          exhausted: item.exhausted,
          damaged: true,
        })),
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

  const character = vagabondCharacterOf(board)

  // Rule: D.2.2 Day Labor — Tinker takes a matching discard-pile card.
  if (character === 'tinker' && hasExhaustible(board, 'torch')) {
    const cardIds = dayLaborCards(state, clearing).map((card) => card.id)
    if (cardIds.length > 0) {
      specs.push({ type: 'dayLabor', actor: seat, params: { cardIds } })
    }
  }

  // Rule: D.3.2 Hideout — Ranger repairs three items, then Daylight ends.
  if (
    character === 'ranger' &&
    hasExhaustible(board, 'torch') &&
    board.damaged.length > 0
  ) {
    specs.push({
      type: 'hideout',
      actor: seat,
      params: {
        vagabondItems: hideoutItemChoices(board),
        itemCount: [hideoutRepairCount(board)],
      },
    })
  }

  // Rule: D.1.2 Steal — Thief takes a random card from a player here.
  if (character === 'thief' && hasExhaustible(board, 'torch')) {
    for (const player of state.players) {
      if (player.seat === seat) continue
      if (!hasCardToTake(state, player.seat)) continue
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

  // Rule: 9.2.5.III — freely move face-up undamaged T/X/B between track and satchel.
  pushRearrangeActions(board, seat, specs)
}

function pushRearrangeActions(
  board: VagabondBoard,
  seat: Seat,
  specs: ActionSpec[],
): void {
  for (const itemType of ['tea', 'coin', 'bag'] as const) {
    const faceUpOnTrack = board.tracks[itemType].some((item) => !item.exhausted)
    if (faceUpOnTrack) {
      specs.push({
        type: 'vbRearrange',
        actor: seat,
        params: { itemTypes: [itemType], rearrangeFrom: ['track'] },
      })
    }
    const faceUpInSatchel = board.satchel.some(
      (item) => item.type === itemType && !item.exhausted,
    )
    if (
      faceUpInSatchel &&
      board.tracks[itemType].length < VAGABOND_TRACK_ITEM_CAP
    ) {
      specs.push({
        type: 'vbRearrange',
        actor: seat,
        params: { itemTypes: [itemType], rearrangeFrom: ['satchel'] },
      })
    }
  }
}
