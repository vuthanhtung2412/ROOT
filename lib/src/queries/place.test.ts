import { describe, expect, it } from 'vitest'
import { FALL } from '../map/fall.js'
import { defaultRuleHooks } from '../triggers/hooks.js'
import { minimalState, withPieces } from '../test/fixtures.js'
import { canMove } from './move.js'
import { canPlace } from './place.js'

const hooks = defaultRuleHooks(FALL)
const keepClearing = FALL.corners[0]!

describe('canPlace', () => {
  it('Rule: Marquise > The Keep — only keep owner may place there', () => {
    const state = withPieces(minimalState(), keepClearing, [
      { id: 'k0', kind: 'token', owner: 0, type: 'keep' },
    ])
    expect(canPlace(state, 0, keepClearing)).toBe(true)
    expect(canPlace(state, 1, keepClearing)).toBe(false)
  })

  it('Rule: Marquise > The Keep — no keep token → unrestricted placement', () => {
    const state = minimalState()
    expect(canPlace(state, 0, keepClearing)).toBe(true)
    expect(canPlace(state, 1, keepClearing)).toBe(true)
  })

  it('Rule: Marquise > The Keep — move-in not blocked by keep', () => {
    const adjacent = FALL.adjacent(keepClearing)[0]!
    const state = withPieces(
      withPieces(minimalState(), keepClearing, [
        { id: 'k0', kind: 'token', owner: 0, type: 'keep' },
        { id: 'w0', kind: 'warrior', owner: 0 },
      ]),
      adjacent,
      [{ id: 'w1', kind: 'warrior', owner: 1 }],
    )
    expect(canPlace(state, 1, keepClearing)).toBe(false)
    expect(canMove(state, 1, adjacent, keepClearing, hooks)).toBe(true)
  })
})
