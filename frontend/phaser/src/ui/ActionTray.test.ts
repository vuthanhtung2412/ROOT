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
