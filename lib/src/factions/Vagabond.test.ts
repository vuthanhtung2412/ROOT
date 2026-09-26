import { describe, expect, it, beforeEach } from 'vitest'
import { VAGABOND } from '#factions/Vagabond.js'
import {
  boardOf,
  exhaustItem,
  refreshItems,
  satchelCapacity,
} from '#factions/vagabond/items.js'
import { resetPlaceIds } from '#rules/place.js'
import {
  THIEF_START_ITEMS,
  createFactionBoard,
} from '#state/boards.js'
import { FALL } from '#map/fall.js'
import {
  minimalState,
  player,
  testContext,
} from '#test/fixtures.js'

describe('Vagabond setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Vagabond > Setup — Thief items + forest pawn slot', () => {
    const board = createFactionBoard('vagabond')
    expect(board.kind).toBe('vagabond')
    if (board.kind !== 'vagabond') return
    expect(board.satchel).toHaveLength(0)
    expect(board.forest).toBeNull()
  })

  it('Rule: Vagabond > Setup 2, 5 — forest + Thief start items', () => {
    const state = minimalState({
      factions: ['marquise', 'eyrie', 'alliance', 'vagabond'],
      players: [
        player(0, 'marquise'),
        player(1, 'eyrie'),
        player(2, 'alliance'),
        player(3, 'vagabond'),
      ],
    })
    VAGABOND.setup(state, 3, testContext({ state }))
    const board = boardOf(state, 3)
    expect(board.forest).toBe(FALL.vagabondForest)
    const types = [
      ...board.satchel.map((item) => item.type),
      ...board.tracks.tea.map((item) => item.type),
      ...board.tracks.coin.map((item) => item.type),
      ...board.tracks.bag.map((item) => item.type),
    ].sort()
    expect(types).toEqual([...THIEF_START_ITEMS].sort())
  })
})

describe('Vagabond items', () => {
  it('Rule: Items — exhaust tea track → satchel', () => {
    const board = createFactionBoard('vagabond')
    if (board.kind !== 'vagabond') return
    board.tracks.tea.push({ type: 'tea', exhausted: false })
    const item = exhaustItem(board, 'tea')
    expect(item?.exhausted).toBe(true)
    expect(board.tracks.tea).toHaveLength(0)
    expect(board.satchel).toHaveLength(1)
  })

  it('Rule: Birdsong Refresh — 3 + 2× face-up tea', () => {
    const board = createFactionBoard('vagabond')
    if (board.kind !== 'vagabond') return
    board.satchel.push(
      { type: 'boot', exhausted: true },
      { type: 'sword', exhausted: true },
      { type: 'torch', exhausted: true },
      { type: 'hammer', exhausted: true },
    )
    board.tracks.tea.push({ type: 'tea', exhausted: false })
    const refreshed = refreshItems(board, 3 + 2 * 1)
    expect(refreshed).toBe(4)
    expect(board.satchel.every((item) => !item.exhausted)).toBe(true)
  })

  it('Rule: Evening Capacity — 6 + 2× face-up bags', () => {
    const board = createFactionBoard('vagabond')
    if (board.kind !== 'vagabond') return
    board.tracks.bag.push({ type: 'bag', exhausted: false })
    expect(satchelCapacity(board)).toBe(8)
  })
})

describe('Vagabond slip / move', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Birdsong Slip — free move into clearing from forest', () => {
    const state = minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(1, 'vagabond')],
      currentSeat: 1,
      phase: 'birdsong',
      step: 'slip',
    })
    VAGABOND.setup(state, 1, testContext({ state }))
    const adjacent = FALL.forests[FALL.vagabondForest]![0]!
    VAGABOND.apply(state, { type: 'slip', to: adjacent }, testContext({ state }))
    const board = boardOf(state, 1)
    expect(board.forest).toBeNull()
    expect(
      state.clearings[adjacent]!.pieces.some(
        (piece) => piece.kind === 'pawn' && piece.owner === 1,
      ),
    ).toBe(true)
  })

  // Rule: Vagabond > Birdsong > Slip (9.4.2) — forest → adjacent forest ok.
  it('Rule: Birdsong Slip — free move into adjacent forest', () => {
    const state = minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(1, 'vagabond')],
      currentSeat: 1,
      phase: 'birdsong',
      step: 'slip',
    })
    VAGABOND.setup(state, 1, testContext({ state }))
    const slip = VAGABOND.legalActions(state, testContext({ state })).find(
      (spec) => spec.type === 'slip',
    )
    expect(slip?.params?.forests).toEqual(
      FALL.adjacentForests(FALL.vagabondForest),
    )
    const destinationForest = FALL.adjacentForests(FALL.vagabondForest)[0]!
    VAGABOND.apply(
      state,
      { type: 'slip', to: `forest:${destinationForest}` },
      testContext({ state }),
    )
    const board = boardOf(state, 1)
    expect(board.forest).toBe(destinationForest)
    expect(
      state.clearings.every(
        (clearing) =>
          !clearing.pieces.some(
            (piece) => piece.kind === 'pawn' && piece.owner === 1,
          ),
      ),
    ).toBe(true)
  })
})
