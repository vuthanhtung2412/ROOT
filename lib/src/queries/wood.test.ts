import { describe, expect, it } from 'vitest'
import { FALL } from '../map/fall.js'
import { defaultRuleHooks } from '../triggers/hooks.js'
import { minimalState, withPieces } from '../test/fixtures.js'
import { woodReachable } from './wood.js'

const hooks = defaultRuleHooks(FALL)

describe('woodReachable', () => {
  it('Rule: Marquise > Build 3 — wood from clearing and ruled connected chain', () => {
    const state = withPieces(
      withPieces(
        withPieces(minimalState(), 4, [
          { id: 'w0a', kind: 'warrior', owner: 0 },
          { id: 'w0b', kind: 'warrior', owner: 0 },
          { id: 'wood4', kind: 'token', owner: 0, type: 'wood' },
        ]),
        0,
        [
          { id: 'w0c', kind: 'warrior', owner: 0 },
          { id: 'wood0', kind: 'token', owner: 0, type: 'wood' },
        ],
      ),
      8,
      [{ id: 'wood8', kind: 'token', owner: 0, type: 'wood' }],
    )
    expect(woodReachable(state, 0, 4, hooks)).toBe(2)
  })
})
