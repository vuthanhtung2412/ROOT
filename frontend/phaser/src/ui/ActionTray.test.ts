import { describe, expect, it } from 'vitest'
import { filterTrayActions, formatActionLabel } from '#ui/ActionTray.ts'

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
