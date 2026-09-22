import { describe, expect, it } from 'vitest'
import { FALL_CLEARING_SUITS, fallClearingSuit } from '#game/boardLayout.ts'

describe('fallClearingSuit', () => {
  it('covers all twelve Autumn clearings', () => {
    expect(Object.keys(FALL_CLEARING_SUITS)).toHaveLength(12)
    for (let clearingId = 0; clearingId < 12; clearingId += 1) {
      expect(fallClearingSuit(clearingId)).not.toBeNull()
    }
  })

  it('matches FallMap fox/mouse/rabbit sets', () => {
    expect(fallClearingSuit(0)).toBe('fox')
    expect(fallClearingSuit(1)).toBe('mouse')
    expect(fallClearingSuit(2)).toBe('rabbit')
    expect(fallClearingSuit(11)).toBe('fox')
    expect(fallClearingSuit(10)).toBe('mouse')
    expect(fallClearingSuit(9)).toBe('rabbit')
  })
})
