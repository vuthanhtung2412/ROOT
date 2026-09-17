import { describe, expect, it } from 'vitest'
import { FALL } from '../map/fall.js'
import { defaultRuleHooks } from '../triggers/hooks.js'
import { minimalState, withPieces } from '../test/fixtures.js'
import { canMove } from './move.js'

const hooks = defaultRuleHooks(FALL)

describe('canMove', () => {
  it('Rule: Move 1 — take >0 warriors from one clearing', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'w0', kind: 'warrior', owner: 0 },
    ])
    expect(canMove(state, 0, 4, 0, hooks)).toBe(true)
    expect(canMove(state, 0, 0, 4, hooks)).toBe(false)
  })

  it('Rule: Move 2 — move to one adjacent clearing', () => {
    const state = withPieces(minimalState(), 4, [
      { id: 'w0', kind: 'warrior', owner: 0 },
      { id: 'w0b', kind: 'warrior', owner: 0 },
    ])
    expect(canMove(state, 0, 4, 6, hooks)).toBe(false)
  })

  it('Rule: Move 3 — must rule origin or destination', () => {
    const state = withPieces(
      withPieces(
        minimalState(),
        4,
        [
          { id: 'w0', kind: 'warrior', owner: 0 },
          { id: 'w1a', kind: 'warrior', owner: 1 },
          { id: 'w1b', kind: 'warrior', owner: 1 },
        ],
      ),
      0,
      [{ id: 'w0b', kind: 'warrior', owner: 0 }],
    )
    expect(canMove(state, 0, 4, 0, hooks)).toBe(true)
    expect(canMove(state, 0, 4, 1, hooks)).toBe(false)
  })
})
