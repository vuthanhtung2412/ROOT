import { describe, expect, it, beforeEach } from 'vitest'
import { ALLIANCE } from '#factions/Alliance.js'
import {
  allianceEveningDrawCount,
  boardOf,
  clearingHasSympathy,
  nextSympathyCost,
  supportersCapacity,
} from '#factions/alliance/rules.js'
import { removePieces } from '#rules/remove.js'
import { resetPlaceIds } from '#rules/place.js'
import {
  ALLIANCE_STARTING_SUPPORTERS,
  ALLIANCE_SUPPORTERS_CAP_WITHOUT_BASE,
  ALLIANCE_SYMPATHY_TRACK_SIZE,
  createFactionBoard,
} from '#state/boards.js'
import {
  card,
  minimalState,
  player,
  testContext,
  withPieces,
} from '#test/fixtures.js'

describe('Alliance setup', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Alliance > Setup — board starts with 10 sympathy, 3 bases, 10 warriors', () => {
    const board = createFactionBoard('alliance')
    expect(board.kind).toBe('alliance')
    if (board.kind !== 'alliance') return
    expect(board.sympathyTrack.placed).toBe(ALLIANCE_SYMPATHY_TRACK_SIZE)
    expect(board.bases).toHaveLength(3)
    expect(board.supply.warriors).toBe(10)
    expect(board.officers).toBe(0)
  })

  it('Rule: Alliance > Setup 4 — draw 3 supporters', () => {
    const state = minimalState({
      factions: ['marquise', 'eyrie', 'alliance'],
      players: [
        player(0, 'marquise'),
        player(1, 'eyrie'),
        player(2, 'alliance'),
      ],
      deck: {
        draw: [
          card('ROOT-72'),
          card('ROOT-57'),
          card('ROOT-72', 2),
          card('ROOT-57', 2),
        ],
        discard: [],
      },
    })
    ALLIANCE.setup(state, 2, testContext({ state }))
    const board = boardOf(state, 2)
    expect(board.supporters).toHaveLength(ALLIANCE_STARTING_SUPPORTERS)
  })
})

describe('Alliance supporters capacity', () => {
  it('Rule: Alliance — no base → max 5 supporters', () => {
    const board = createFactionBoard('alliance')
    if (board.kind !== 'alliance') return
    expect(supportersCapacity(board)).toBe(ALLIANCE_SUPPORTERS_CAP_WITHOUT_BASE)
  })

  it('Rule: Alliance — any base on map → unlimited supporters', () => {
    const board = createFactionBoard('alliance')
    if (board.kind !== 'alliance') return
    board.bases.pop()
    expect(supportersCapacity(board)).toBeNull()
  })
})

describe('Alliance evening draw', () => {
  it('Rule: 8.6.2 — draw 1 + uncovered Bases draw bonuses', () => {
    const board = createFactionBoard('alliance')
    if (board.kind !== 'alliance') return
    expect(allianceEveningDrawCount(board)).toBe(1)
    board.bases.pop()
    expect(allianceEveningDrawCount(board)).toBe(2)
    board.bases.pop()
    expect(allianceEveningDrawCount(board)).toBe(3)
  })
})

describe('Alliance base removal', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 8.2.4 — removed base returns to Bases box; supporters cap resumes', () => {
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'eyrie', 'alliance'],
        players: [
          player(0, 'marquise'),
          player(1, 'eyrie'),
          player(2, 'alliance'),
        ],
      }),
      0,
      [{ id: 'base-fox', kind: 'building', type: 'base', owner: 2, used: false }],
    )
    const board = boardOf(state, 2)
    board.bases = board.bases.filter((suit) => suit !== 'fox')
    expect(board.bases.includes('fox')).toBe(false)
    expect(supportersCapacity(board)).toBeNull()

    removePieces(state, { clearing: 0, pieceIds: ['base-fox'], scorer: 0 })

    expect(board.bases.includes('fox')).toBe(true)
    expect(supportersCapacity(board)).toBe(ALLIANCE_SUPPORTERS_CAP_WITHOUT_BASE)
  })
})

describe('Alliance spreadSympathy', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Alliance Spread — place sympathy and score track VP', () => {
    const state = minimalState({
      factions: ['marquise', 'eyrie', 'alliance'],
      players: [
        player(0, 'marquise'),
        player(1, 'eyrie'),
        player(2, 'alliance'),
      ],
      currentSeat: 2,
      phase: 'birdsong',
      step: 'actions',
    })
    const board = boardOf(state, 2)
    const fox = card('ROOT-72')
    board.supporters = [fox]
    expect(nextSympathyCost(board)).toBe(1)

    ALLIANCE.apply(
      state,
      {
        type: 'spreadSympathy',
        clearing: 0,
        supporterIds: [fox.id],
      },
      testContext({ state }),
    )

    expect(clearingHasSympathy(state, 0, 2)).toBe(true)
    expect(board.sympathyTrack.placed).toBe(ALLIANCE_SYMPATHY_TRACK_SIZE - 1)
    expect(state.players[2]!.vp).toBe(0)
  })

  it('Rule: first sympathy any clearing; never stack two in one clearing', () => {
    const state = minimalState({
      factions: ['marquise', 'eyrie', 'alliance'],
      players: [
        player(0, 'marquise'),
        player(1, 'eyrie'),
        player(2, 'alliance'),
      ],
      currentSeat: 2,
      phase: 'birdsong',
      step: 'actions',
    })
    const board = boardOf(state, 2)
    const firstFox = card('ROOT-72')
    const secondFox = card('ROOT-72', 2)
    board.supporters = [firstFox, secondFox, card('ROOT-57'), card('ROOT-84')]

    const legal = ALLIANCE.legalActions(state, testContext({ state }))
    const spreadClearings = new Set(
      legal
        .filter((spec) => spec.type === 'spreadSympathy')
        .flatMap((spec) => spec.params?.clearings ?? []),
    )
    expect(spreadClearings.size).toBeGreaterThan(1)

    ALLIANCE.apply(
      state,
      {
        type: 'spreadSympathy',
        clearing: 0,
        supporterIds: [firstFox.id],
      },
      testContext({ state }),
    )
    expect(clearingHasSympathy(state, 0, 2)).toBe(true)
    expect(() =>
      ALLIANCE.apply(
        state,
        {
          type: 'spreadSympathy',
          clearing: 0,
          supporterIds: [secondFox.id],
        },
        testContext({ state }),
      ),
    ).toThrow(/ALREADY_SYMPATHETIC/)
  })
})
