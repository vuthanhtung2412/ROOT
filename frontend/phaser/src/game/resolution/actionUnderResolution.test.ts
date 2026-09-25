import { describe, expect, it } from 'vitest'
import { isActionUnderResolution } from '#game/resolution/actionUnderResolution.ts'

describe('isActionUnderResolution', () => {
  it('is false when every draft is idle', () => {
    expect(
      isActionUnderResolution([
        { type: 'idle' },
        { type: 'idle' },
        { type: 'idle' },
      ]),
    ).toBe(false)
  })

  it('is false for empty draft list', () => {
    expect(isActionUnderResolution([])).toBe(false)
  })

  it('is true when any draft is not idle', () => {
    expect(
      isActionUnderResolution([
        { type: 'idle' },
        { type: 'march' },
        { type: 'idle' },
      ]),
    ).toBe(true)
  })
})
