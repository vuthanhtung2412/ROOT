import { describe, expect, it } from 'vitest'
import { warriors } from '../queries/pieces.js'
import { minimalState, testContext, withPieces } from '../test/fixtures.js'
import { moveWarriors } from './move.js'

describe('moveWarriors', () => {
  it('Rule: Move 1–3 — moves warriors between adjacent ruled clearings', () => {
    const state = withPieces(
      withPieces(minimalState(), 4, [
        { id: 'w0a', kind: 'warrior', owner: 0 },
        { id: 'w0b', kind: 'warrior', owner: 0 },
      ]),
      0,
      [{ id: 'w0c', kind: 'warrior', owner: 0 }],
    )
    moveWarriors(state, 0, 4, 0, 2, testContext({ state }))
    expect(warriors(state, 4, 0)).toBe(0)
    expect(warriors(state, 0, 0)).toBe(3)
  })
})
