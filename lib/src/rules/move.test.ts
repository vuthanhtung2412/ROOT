import { describe, expect, it } from 'vitest'
import { FALL } from '../map/fall.js'
import { warriors } from '../queries/pieces.js'
import { defaultRuleHooks } from '../triggers/hooks.js'
import { minimalState, withPieces } from '../test/fixtures.js'
import { moveWarriors } from './move.js'

function ctx() {
  const hooks = defaultRuleHooks(FALL)
  return {
    map: FALL,
    rng: { roll: () => 1, toJSON: () => ({ seed: 1, cursor: 0 }) },
    emit: () => {},
    hooks,
    grantedActions: () => [],
  }
}

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
    moveWarriors(state, 0, 4, 0, 2, ctx())
    expect(warriors(state, 4, 0)).toBe(0)
    expect(warriors(state, 0, 0)).toBe(3)
  })
})
