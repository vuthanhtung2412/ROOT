import { describe, expect, it } from 'vitest'
import {
  BUY_SERVICE_ICON_KEY,
  DECLINE_ICON_KEY,
  DECLINE_SERVICE_ICON_KEY,
  trayActionArt,
  collapseTrayActionsByLabel,
  filterTrayActions,
  withoutBoardOnlyActions,
  formatActionLabel,
  partitionTrayActionRegions,
} from '#ui/ActionTray.ts'
import { makeActionSpec, makeGameState } from '#test/factories.ts'
import { actionIconFor } from '#ui/actionIcons.ts'
import { questViewsFromState } from '#ui/factionBoardViewModel.ts'

describe('formatActionLabel setup', () => {
  it('labels keep vs starting buildings distinctly', () => {
    expect(
      formatActionLabel({
        type: 'resolveEvent',
        actor: 0,
        params: { clearing: [0, 2, 8, 10] },
      }),
    ).toBe('choose keep')
    expect(
      formatActionLabel({
        type: 'resolveEvent',
        actor: 0,
        params: { clearing: [0, 1], building: ['sawmill'] },
      }),
    ).toBe('place sawmill')
    expect(
      formatActionLabel({
        type: 'resolveEvent',
        actor: 0,
        params: { clearing: [0, 1], building: ['workshop'] },
      }),
    ).toBe('place workshop')
    expect(
      formatActionLabel({
        type: 'resolveEvent',
        actor: 0,
        params: { clearing: [0, 1], building: ['recruiter'] },
      }),
    ).toBe('place recruiter')
  })
})

describe('filterTrayActions march lock', () => {
  it('keeps only locked action types while march staged', () => {
    const actions = [
      { type: 'march', actor: 0, params: { moves: [] } },
      { type: 'build', actor: 0, params: {} },
      { type: 'recruit', actor: 0, params: {} },
    ]
    expect(
      filterTrayActions(actions, 0, { lockToActionTypes: ['march'] }),
    ).toEqual([{ type: 'march', actor: 0, params: { moves: [] } }])
    expect(filterTrayActions(actions, 0)).toHaveLength(3)
  })

  it('returns no actions when disabled during march', () => {
    const actions = [
      { type: 'march', actor: 0, params: { moves: [] } },
      { type: 'build', actor: 0, params: {} },
    ]
    expect(filterTrayActions(actions, 0, { disabled: true })).toEqual([])
  })
})

describe('formatActionLabel decree suit', () => {
  it('includes card suit from cardIds', () => {
    expect(
      formatActionLabel(
        {
          type: 'decree',
          actor: 1,
          params: { column: ['recruit'], cardIds: ['ROOT-204#1'] },
        },
        undefined,
        {
          id: 'g',
          seed: 1,
          status: 'playing',
          turn: 1,
          currentSeat: 1,
          phase: 'daylight',
          step: 'decree',
          factions: ['marquise', 'eyrie'],
          players: [
            {
              playerId: 'e',
              seat: 1,
              faction: 'eyrie',
              vp: 0,
              hand: [],
            },
          ],
          clearings: [],
          pending: [],
        },
      ),
    ).toBe('recruit: fox')
  })

  it('vizier resolves as bird suit', () => {
    expect(
      formatActionLabel({
        type: 'decree',
        actor: 1,
        params: { column: ['move'], cardIds: ['VIZIER#1'] },
      }),
    ).toBe('move: bird')
  })
})

describe('formatActionLabel Field Hospitals', () => {
  it('labels pay and decline when pending is fieldHospital', () => {
    const pending = { type: 'fieldHospital', victim: 0, clearing: 4, count: 1 }
    expect(
      formatActionLabel(
        {
          type: 'resolveEvent',
          actor: 0,
          params: { decline: [true] },
        },
        pending,
      ),
    ).toBe('Decline Field Hospitals')
    expect(
      formatActionLabel(
        {
          type: 'resolveEvent',
          actor: 0,
          params: { cardIds: ['ROOT-72#1'] },
        },
        pending,
      ),
    ).toBe('Field Hospitals: pay')
  })
})

describe('collapseTrayActionsByLabel', () => {
  it('merges duplicate Vagabond battle/aid/steal into one button each', () => {
    const collapsed = collapseTrayActionsByLabel([
      {
        type: 'vbBattle',
        actor: 3,
        params: { targets: [{ clearing: 5, defender: 0 }] },
      },
      {
        type: 'vbBattle',
        actor: 3,
        params: { targets: [{ clearing: 5, defender: 1 }] },
      },
      {
        type: 'aid',
        actor: 3,
        params: { cardIds: ['ROOT-202#1'], defender: [0] },
      },
      {
        type: 'aid',
        actor: 3,
        params: { cardIds: ['ROOT-202#1'], defender: [1] },
      },
      { type: 'steal', actor: 3, params: { defender: [0] } },
      { type: 'steal', actor: 3, params: { defender: [2] } },
      { type: 'endPhase', actor: 3 },
    ])
    expect(collapsed.map((spec) => spec.type)).toEqual([
      'vbBattle',
      'aid',
      'steal',
      'endPhase',
    ])
    expect(collapsed[0]?.params?.targets).toEqual([
      { clearing: 5, defender: 0 },
      { clearing: 5, defender: 1 },
    ])
    expect(collapsed[1]?.params?.defender).toEqual([0, 1])
    expect(collapsed[2]?.params?.defender).toEqual([0, 2])
  })

  it('keeps Marquise daylight types as one button each', () => {
    const collapsed = collapseTrayActionsByLabel([
      { type: 'recruit', actor: 0 },
      {
        type: 'march',
        actor: 0,
        params: { moves: [{ from: 1, to: 2 }] },
      },
      {
        type: 'build',
        actor: 0,
        params: { options: [{ clearing: 3, building: 'sawmill' }] },
      },
      {
        type: 'battle',
        actor: 0,
        params: {
          targets: [
            { clearing: 4, defender: 1 },
            { clearing: 5, defender: 2 },
          ],
        },
      },
      { type: 'endPhase', actor: 0 },
    ])
    expect(collapsed.map((spec) => spec.type)).toEqual([
      'recruit',
      'march',
      'build',
      'battle',
      'endPhase',
    ])
  })

  it('keeps distinct decree labels separate', () => {
    const collapsed = collapseTrayActionsByLabel([
      {
        type: 'decree',
        actor: 1,
        params: { column: ['recruit'], cardIds: ['ROOT-204#1'] },
      },
      {
        type: 'decree',
        actor: 1,
        params: { column: ['move'], cardIds: ['VIZIER#1'] },
      },
    ])
    expect(collapsed).toHaveLength(2)
  })
})

describe('partitionTrayActionRegions', () => {
  it('puts Marquise daylight choices in Actions and spend bird/end phase in Turn', () => {
    const regions = partitionTrayActionRegions([
      { type: 'recruit', actor: 0 },
      { type: 'battle', actor: 0, params: { targets: [] } },
      { type: 'build', actor: 0, params: { options: [] } },
      {
        type: 'spendBird',
        actor: 0,
        params: { cardIds: ['ROOT-01#1'] },
      },
      { type: 'endPhase', actor: 0 },
    ])
    expect(regions.map((region) => region.id)).toEqual(['actions', 'meta'])
    expect(regions[0]?.title).toBe('Actions (3)')
    expect(regions[0]?.actions.map((spec) => spec.type)).toEqual([
      'recruit',
      'battle',
      'build',
    ])
    expect(regions[1]?.title).toBe('Turn (2)')
    expect(regions[1]?.actions.map((spec) => spec.type)).toEqual([
      'spendBird',
      'endPhase',
    ])
  })

  it('shows Marquise daylight action budget left in Actions title', () => {
    const regions = partitionTrayActionRegions(
      [
        { type: 'recruit', actor: 0 },
        { type: 'battle', actor: 0, params: { targets: [] } },
        { type: 'endPhase', actor: 0 },
      ],
      makeGameState({
        phase: 'daylight',
        step: 'actions',
        currentSeat: 0,
        turnScratch: { actionsLeft: 2, extraActions: 1 },
      }),
    )
    expect(regions[0]?.title).toBe('Actions · 3 left')
  })

  it('omits empty Actions region when only end phase remains', () => {
    const regions = partitionTrayActionRegions([
      { type: 'endPhase', actor: 0 },
    ])
    expect(regions).toEqual([
      {
        id: 'meta',
        title: 'Turn',
        actions: [{ type: 'endPhase', actor: 0 }],
      },
    ])
  })
})

describe('withoutBoardOnlyActions', () => {
  it('keeps Vagabond board actions (item moves, quests) off the tray', () => {
    const move = makeActionSpec({ type: 'vbMove', actor: 3 })
    const rearrange = makeActionSpec({
      type: 'vbRearrange',
      actor: 3,
      params: { itemTypes: ['tea'], rearrangeFrom: ['track'] },
    })
    const quest = makeActionSpec({
      type: 'quest',
      actor: 3,
      params: { questIds: ['QUEST-M-ESCORT#1'], rewards: ['vp', 'draw'] },
    })

    expect(withoutBoardOnlyActions([move, rearrange, quest])).toEqual([move])
  })
})

describe('trayActionArt', () => {
  const buyServicesPending = { type: 'buyServices', buyer: 0, bought: 0 }

  it('tells buying a service from declining it', () => {
    const buy = makeActionSpec({
      type: 'resolveEvent',
      params: { options: [{ service: 'riverboats' }] },
    })
    const decline = makeActionSpec({
      type: 'resolveEvent',
      params: { decline: [true] },
    })

    expect(trayActionArt(buy, makeGameState(), buyServicesPending)).toEqual({
      iconKey: BUY_SERVICE_ICON_KEY,
      suit: null,
    })
    expect(
      trayActionArt(decline, makeGameState(), buyServicesPending),
    ).toEqual({ iconKey: DECLINE_SERVICE_ICON_KEY, suit: null })
    // Declining any other event (ambush, Field Hospitals) keeps the plain mark.
    expect(trayActionArt(decline, makeGameState()).iconKey).toBe(
      DECLINE_ICON_KEY,
    )
  })

  it('draws a Decree action as its column', () => {
    const decree = makeActionSpec({
      type: 'decree',
      params: { column: ['recruit'] },
    })

    expect(trayActionArt(decree, makeGameState())).toEqual({
      iconKey: 'recruit',
      suit: null,
    })
  })

  it('draws each Woodland Alliance military operation as its own icon', () => {
    const operations: readonly string[] = [
      'move',
      'battle',
      'recruit',
      'organize',
    ]

    const iconKeys: string[] = operations.map(
      (operation: string): string =>
        trayActionArt(
          makeActionSpec({ type: 'militaryOp', params: { op: [operation] } }),
        ).iconKey,
    )

    expect(iconKeys).toEqual(operations)
    expect(new Set(iconKeys.map(actionIconFor)).size).toBe(operations.length)
  })

  it('keeps the action type for any other action', () => {
    const march = makeActionSpec({ type: 'march' })

    expect(trayActionArt(march).iconKey).toBe('march')
  })
})

describe('questViewsFromState', () => {
  it('names each face-up quest and points at its card face', () => {
    // `questsAvailable` is not in the generated client type yet.
    const state = Object.assign(makeGameState(), {
      questsAvailable: [{ id: 'QUEST-F-FUNDS#1', defId: 'QUEST-F-FUNDS' }],
    })

    expect(questViewsFromState(state)).toEqual([
      {
        id: 'QUEST-F-FUNDS#1',
        defId: 'QUEST-F-FUNDS',
        name: 'Fundraising',
        suit: 'fox',
        items: ['coin', 'tea'],
        imagePath: '/assets/quests/quest-fundraising.png',
      },
    ])
  })
})
