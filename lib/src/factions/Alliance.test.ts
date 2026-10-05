import { describe, expect, it, beforeEach } from 'vitest'
import { ALLIANCE } from '#factions/Alliance.js'
import {
  allianceEveningDrawCount,
  boardOf,
  clearingHasSympathy,
  nextSympathyCost,
  supportersCapacity,
} from '#factions/alliance/rules.js'
import { FALL } from '#map/fall.js'
import { canPlace } from '#queries/place.js'
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
      [{ id: 'base-fox', kind: 'building', type: 'base', owner: 2 }],
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

describe('Alliance revolt Birdsong', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: 8.4 — birdsong is revolt step then spread step', () => {
    expect(ALLIANCE.steps.birdsong).toEqual(['revolt', 'spread'])
  })

  it('Rule: 8.4.1.II — revolt exposes supporter pair choices', () => {
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'eyrie', 'alliance'],
        players: [
          player(0, 'marquise'),
          player(1, 'eyrie'),
          player(2, 'alliance'),
        ],
        currentSeat: 2,
        phase: 'birdsong',
        step: 'revolt',
      }),
      0,
      [{ id: 'sym', kind: 'token', type: 'sympathy', owner: 2 }],
    )
    const board = boardOf(state, 2)
    const foxA = card('ROOT-72')
    const foxB = card('ROOT-72', 2)
    const foxC = card('ROOT-57')
    board.supporters = [foxA, foxB, foxC]

    const revolt = ALLIANCE.legalActions(state, testContext({ state })).find(
      (spec) => spec.type === 'revolt',
    )
    expect(revolt?.params?.options).toEqual(
      expect.arrayContaining([
        { clearing: 0, supporterIds: [foxA.id, foxB.id] },
        { clearing: 0, supporterIds: [foxA.id, foxC.id] },
        { clearing: 0, supporterIds: [foxB.id, foxC.id] },
      ]),
    )
    expect(
      ALLIANCE.legalActions(state, testContext({ state })).some(
        (spec) => spec.type === 'spreadSympathy',
      ),
    ).toBe(false)
  })

  it('Rule: 8.4.1.III — revolt legal when enemy building frees the only slot', () => {
    // Clearing 0 on Fall has 1 slot; fill with enemy building + sympathy.
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'eyrie', 'alliance'],
        players: [
          player(0, 'marquise'),
          player(1, 'eyrie'),
          player(2, 'alliance'),
        ],
        currentSeat: 2,
        phase: 'birdsong',
        step: 'revolt',
      }),
      0,
      [
        { id: 'sym', kind: 'token', type: 'sympathy', owner: 2 },
        {
          id: 'saw',
          kind: 'building',
          type: 'sawmill',
          owner: 0,
        },
      ],
    )
    const board = boardOf(state, 2)
    board.supporters = [card('ROOT-72'), card('ROOT-72', 2)]

    const revolt = ALLIANCE.legalActions(state, testContext({ state })).find(
      (spec) => spec.type === 'revolt',
    )
    expect(revolt).toBeDefined()
    const firstOption = revolt?.params?.options?.[0]
    expect(firstOption).toBeDefined()
    if (firstOption === undefined || !('clearing' in firstOption)) {
      throw new Error('expected RevoltChoice')
    }
    expect(firstOption.clearing).toBe(0)

    ALLIANCE.apply(
      state,
      {
        type: 'revolt',
        clearing: 0,
        supporterIds: [board.supporters[0]!.id, board.supporters[1]!.id],
      },
      testContext({ state }),
    )
    expect(
      state.clearings[0]!.pieces.some(
        (piece) =>
          piece.kind === 'building' &&
          piece.type === 'base' &&
          piece.owner === 2,
      ),
    ).toBe(true)
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
      step: 'spread',
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
      step: 'spread',
    })
    const board = boardOf(state, 2)
    const firstFox = card('ROOT-72')
    const secondFox = card('ROOT-72', 2)
    board.supporters = [firstFox, secondFox, card('ROOT-57'), card('ROOT-84')]

    const legal = ALLIANCE.legalActions(state, testContext({ state }))
    const spread = legal.find((spec) => spec.type === 'spreadSympathy')
    const options = spread?.params?.options ?? []
    const spreadClearings = new Set(
      options.map((choice) => {
        if (
          typeof choice !== 'object' ||
          choice === null ||
          !('clearing' in choice)
        ) {
          return -1
        }
        const clearing: unknown = Reflect.get(choice, 'clearing')
        return typeof clearing === 'number' ? clearing : -1
      }),
    )
    expect(spreadClearings.has(-1)).toBe(false)
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

  it('Rule: first spread — birds + mouse can pay mouse clearing (cost 1)', () => {
    const state = minimalState({
      factions: ['marquise', 'eyrie', 'alliance'],
      players: [
        player(0, 'marquise'),
        player(1, 'eyrie'),
        player(2, 'alliance'),
      ],
      currentSeat: 2,
      phase: 'birdsong',
      step: 'spread',
    })
    const board = boardOf(state, 2)
    const mouse = card('ROOT-84')
    const birdA = card('ROOT-57')
    const birdB = card('ROOT-57', 2)
    board.supporters = [mouse, birdA, birdB]

    const mouseClearings = FALL.clearings
      .filter((clearing) => clearing.suit === 'mouse')
      .map((clearing) => clearing.id)
    expect(mouseClearings.length).toBeGreaterThan(0)

    const spread = ALLIANCE.legalActions(state, testContext({ state })).find(
      (spec) => spec.type === 'spreadSympathy',
    )
    const options = spread?.params?.options ?? []
    const mouseOptions = options.filter((choice) => {
      if (typeof choice !== 'object' || choice === null) return false
      const clearing = Reflect.get(choice, 'clearing')
      return typeof clearing === 'number' && mouseClearings.includes(clearing)
    })
    expect(mouseOptions.length).toBeGreaterThan(0)

    const pick = mouseOptions[0]!
    const clearing = Reflect.get(pick, 'clearing')
    const supporterIds = Reflect.get(pick, 'supporterIds')
    expect(typeof clearing).toBe('number')
    expect(Array.isArray(supporterIds)).toBe(true)
    if (typeof clearing !== 'number' || !Array.isArray(supporterIds)) {
      throw new Error('expected mouse spread option')
    }

    ALLIANCE.apply(
      state,
      {
        type: 'spreadSympathy',
        clearing,
        supporterIds: supporterIds.filter(
          (id): id is string => typeof id === 'string',
        ),
      },
      testContext({ state }),
    )
    expect(clearingHasSympathy(state, clearing, 2)).toBe(true)
  })

  it('Rule: 6.2.2 The Keep — cannot spread sympathy into keep clearing', () => {
    const keep = FALL.corners[0]!
    const adjacent = FALL.adjacent(keep)[0]!
    const state = withPieces(
      minimalState({
        factions: ['marquise', 'eyrie', 'alliance'],
        players: [
          player(0, 'marquise'),
          player(1, 'eyrie'),
          player(2, 'alliance'),
        ],
        currentSeat: 2,
        phase: 'birdsong',
        step: 'spread',
      }),
      keep,
      [{ id: 'keep-0', kind: 'token', owner: 0, type: 'keep' }],
    )
    // Anchor sympathy adjacent so keep is a candidate by adjacency alone.
    state.clearings[adjacent]!.pieces.push({
      id: 'sym-adj',
      kind: 'token',
      type: 'sympathy',
      owner: 2,
    })
    const board = boardOf(state, 2)
    board.sympathyTrack.placed = ALLIANCE_SYMPATHY_TRACK_SIZE - 1
    board.supporters = [
      card('ROOT-202'),
      card('ROOT-202', 2),
      card('ROOT-201'),
      card('ROOT-201', 2),
      card('ROOT-200'),
    ]

    expect(canPlace(state, 2, keep)).toBe(false)

    const legal = ALLIANCE.legalActions(state, testContext({ state }))
    const spread = legal.find((spec) => spec.type === 'spreadSympathy')
    const options = spread?.params?.options ?? []
    const keepOption = options.find((choice) => {
      if (typeof choice !== 'object' || choice === null || !('clearing' in choice)) {
        return false
      }
      return Reflect.get(choice, 'clearing') === keep
    })
    expect(keepOption).toBeUndefined()

    expect(() =>
      ALLIANCE.apply(
        state,
        {
          type: 'spreadSympathy',
          clearing: keep,
          supporterIds: [board.supporters[0]!.id],
        },
        testContext({ state }),
      ),
    ).toThrow(/KEEP_BLOCKS_PLACE/)
    expect(clearingHasSympathy(state, keep, 2)).toBe(false)
    expect(board.sympathyTrack.placed).toBe(ALLIANCE_SYMPATHY_TRACK_SIZE - 1)
  })
})
