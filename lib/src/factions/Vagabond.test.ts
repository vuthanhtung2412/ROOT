import { describe, expect, it, beforeEach } from 'vitest'
import { VAGABOND } from '#factions/Vagabond.js'
import {
  boardOf,
  exhaustItem,
  placeItemInSatchelOrTrack,
  refreshItems,
  satchelCapacity,
} from '#factions/vagabond/items.js'
import { FALL } from '#map/fall.js'
import { warriors } from '#queries/pieces.js'
import { resetPlaceIds } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import { SeededRng } from '#rules/Rng.js'
import {
  FACE_UP_QUEST_COUNT,
  THIEF_START_ITEMS,
  VAGABOND_ALLIED_STEP,
  VAGABOND_TRACK_ITEM_CAP,
  createFactionBoard,
} from '#state/boards.js'
import {
  minimalState,
  player,
  testContext,
  withPieces,
} from '#test/fixtures.js'

function setupContext(state: ReturnType<typeof minimalState>) {
  return testContext({
    state,
    rng: new SeededRng({ seed: 1, cursor: 0 }),
  })
}

describe('Vagabond setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Vagabond > Setup — Thief items + forest pawn slot', () => {
    const board = createFactionBoard('vagabond')
    expect(board.kind).toBe('vagabond')
    if (board.kind !== 'vagabond') return
    expect(board.satchel).toHaveLength(0)
    expect(board.forest).toBeNull()
    expect(board.completedQuests).toHaveLength(0)
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
    VAGABOND.setup(state, 3, setupContext(state))
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

  it('Rule: Vagabond > Setup 3 — shuffle quests; draw 3 face up', () => {
    const state = minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(1, 'vagabond')],
    })
    VAGABOND.setup(state, 1, setupContext(state))
    expect(state.questsAvailable).toHaveLength(FACE_UP_QUEST_COUNT)
    expect(state.questDeck).toHaveLength(15 - FACE_UP_QUEST_COUNT)
    const ids = new Set([
      ...state.questsAvailable.map((quest) => quest.id),
      ...state.questDeck.map((quest) => quest.id),
    ])
    expect(ids.size).toBe(15)
  })

  it('Rule: Vagabond > Share Quests 9.7.2 — second setup does not draw extra', () => {
    const state = minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(1, 'vagabond')],
    })
    VAGABOND.setup(state, 1, setupContext(state))
    const firstFaceUp = state.questsAvailable.map((quest) => quest.id)
    const deckCount = state.questDeck.length
    VAGABOND.setup(state, 1, setupContext(state))
    expect(state.questsAvailable.map((quest) => quest.id)).toEqual(firstFaceUp)
    expect(state.questDeck).toHaveLength(deckCount)
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
    VAGABOND.setup(state, 1, setupContext(state))
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
    VAGABOND.setup(state, 1, setupContext(state))
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

describe('Vagabond relationships / items SoT', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 9.2.5.I — tea/coin/bag tracks cap at 3', () => {
    const board = createFactionBoard('vagabond')
    if (board.kind !== 'vagabond') return
    placeItemInSatchelOrTrack(board, 'tea')
    placeItemInSatchelOrTrack(board, 'tea')
    placeItemInSatchelOrTrack(board, 'tea')
    placeItemInSatchelOrTrack(board, 'tea')
    expect(board.tracks.tea).toHaveLength(VAGABOND_TRACK_ITEM_CAP)
    expect(board.satchel.filter((item) => item.type === 'tea')).toHaveLength(1)
  })

  it('Rule: 9.5.7 Repair — keep exhausted face', () => {
    const state = minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(1, 'vagabond')],
      currentSeat: 1,
      phase: 'daylight',
      step: 'daylight',
    })
    VAGABOND.setup(state, 1, setupContext(state))
    const board = boardOf(state, 1)
    board.forest = null
    const clearing = FALL.forests[FALL.vagabondForest]![0]!
    state.clearings[clearing]!.pieces.push({
      id: 'pawn-1',
      kind: 'pawn',
      owner: 1,
    })
    board.satchel.push({ type: 'hammer', exhausted: false })
    board.damaged.push({ type: 'crossbow', exhausted: true })
    VAGABOND.apply(
      state,
      { type: 'repair', itemIndex: 0 },
      testContext({ state }),
    )
    expect(board.damaged).toHaveLength(0)
    const repaired = board.satchel.find((item) => item.type === 'crossbow')
    expect(repaired?.exhausted).toBe(true)
  })

  it('Rule: 9.2.5.III — rearrange face-up undamaged track item to satchel', () => {
    const board = createFactionBoard('vagabond')
    if (board.kind !== 'vagabond') return
    board.tracks.tea.push({ type: 'tea', exhausted: false })
    placeItemInSatchelOrTrack(board, 'boot')
    const state = minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(1, 'vagabond', { board })],
      currentSeat: 1,
      phase: 'daylight',
      step: 'daylight',
    })
    VAGABOND.apply(
      state,
      { type: 'vbRearrange', itemType: 'tea', from: 'track' },
      testContext({ state }),
    )
    expect(boardOf(state, 1).tracks.tea).toHaveLength(0)
    expect(boardOf(state, 1).satchel.some((item) => item.type === 'tea')).toBe(
      true,
    )
  })

  it('Rule: 9.2.9.IIb — Allied move may drag warriors', () => {
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'vagabond'],
        players: [player(0, 'marquise'), player(1, 'vagabond')],
        currentSeat: 1,
        phase: 'daylight',
        step: 'daylight',
      }),
      4,
      [
        { id: 'pawn-1', kind: 'pawn', owner: 1 },
        { id: 'ally-w', kind: 'warrior', owner: 0 },
      ],
    )
    const board = boardOf(state, 1)
    board.forest = null
    board.relationships.marquise = VAGABOND_ALLIED_STEP
    board.satchel.push({ type: 'boot', exhausted: false })
    const destination = FALL.adjacent(4)[0]!
    VAGABOND.apply(
      state,
      { type: 'vbMove', to: destination, allySeat: 0, allyCount: 1 },
      testContext({ state }),
    )
    expect(warriors(state, destination, 0)).toBe(1)
    expect(warriors(state, 4, 0)).toBe(0)
  })

  it('Rule: 9.2.9.III/IIIa — battle Hostile then Infamy; strike no Infamy', () => {
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'vagabond'],
        players: [player(0, 'marquise'), player(1, 'vagabond')],
        currentSeat: 1,
        phase: 'daylight',
        step: 'daylight',
      }),
      4,
      [
        { id: 'w1', kind: 'warrior', owner: 0 },
        { id: 'w2', kind: 'warrior', owner: 0 },
        { id: 'tok', kind: 'token', type: 'wood', owner: 0 },
      ],
    )
    const board = boardOf(state, 1)
    board.relationships.marquise = 0

    removePieces(
      state,
      {
        clearing: 4,
        pieceIds: ['w1'],
        scorer: 1,
        options: { fromBattle: true },
      },
      testContext({ state }),
    )
    expect(board.relationships.marquise).toBe('hostile')
    expect(state.players[1]!.vp).toBe(0)

    removePieces(
      state,
      {
        clearing: 4,
        pieceIds: ['w2', 'tok'],
        scorer: 1,
        options: { fromBattle: true },
      },
      testContext({ state }),
    )
    // Infamy: warrior + wood token of already-Hostile (+1 building/token VP for wood)
    expect(state.players[1]!.vp).toBe(3)

    const strikeState = withPieces(
      minimalState({
        factions: ['marquise', 'vagabond'],
        players: [player(0, 'marquise'), player(1, 'vagabond')],
        currentSeat: 1,
      }),
      5,
      [{ id: 'hostile-w', kind: 'warrior', owner: 0 }],
    )
    const strikeBoard = boardOf(strikeState, 1)
    strikeBoard.relationships.marquise = 'hostile'
    removePieces(
      strikeState,
      { clearing: 5, pieceIds: ['hostile-w'], scorer: 1 },
      testContext({ state: strikeState }),
    )
    expect(strikeState.players[1]!.vp).toBe(0)
  })
})
