import { describe, expect, it } from 'vitest'
import { minimalState, withPieces } from '#test/fixtures.js'
import { openSlots } from '#queries/slots.js'

describe('openSlots', () => {
  it('Rule: Board > Slots — no open slot when buildings fill slots', () => {
    const state = withPieces(minimalState(), 0, [
      {
        id: 'b1',
        kind: 'building',
        owner: 0,
        type: 'sawmill',
        used: false,
      },
    ])
    expect(openSlots(state, 0)).toBe(0)
  })

  it('Rule: Board > Slots — ruins occupy one slot', () => {
    const clearings = minimalState().clearings.map((c, i) =>
      i === 5 ? { pieces: [], ruin: { items: ['boot' as const] } } : c,
    )
    const state = minimalState({ clearings })
    expect(openSlots(state, 5)).toBe(1)
  })
})
