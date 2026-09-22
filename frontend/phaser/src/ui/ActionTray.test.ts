import { describe, expect, it } from 'vitest'
import { formatActionLabel } from '#ui/ActionTray.ts'

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
