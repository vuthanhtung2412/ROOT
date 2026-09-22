import { describe, expect, it } from 'vitest'
import { FALL } from '#map/fall.js'
import { defaultRuleHooks } from '#triggers/hooks.js'
import { minimalState, withPieces } from '#test/fixtures.js'
import { connectedRuled } from '#queries/connected.js'

const hooks = defaultRuleHooks(FALL)

describe('connectedRuled', () => {
  it('Rule: Marquise > Build 3 — chain of ruled clearings connects wood', () => {
    // 4 — 0 — 8 path; seat 0 rules 4 and 0
    const state = withPieces(
      withPieces(minimalState(), 4, [
        { id: 'w0a', kind: 'warrior', owner: 0 },
        { id: 'w0b', kind: 'warrior', owner: 0 },
      ]),
      0,
      [{ id: 'w0c', kind: 'warrior', owner: 0 }],
    )
    const region = connectedRuled(state, 0, 4, hooks)
    expect(region.has(4)).toBe(true)
    expect(region.has(0)).toBe(true)
    expect(region.has(8)).toBe(false)
  })

  it('Rule: Marquise > Build 3 — unruly clearing breaks chain', () => {
    const state = withPieces(
      withPieces(minimalState(), 4, [{ id: 'w0', kind: 'warrior', owner: 0 }]),
      0,
      [{ id: 'w1', kind: 'warrior', owner: 1 }],
    )
    const region = connectedRuled(state, 0, 4, hooks)
    expect(region.has(4)).toBe(true)
    expect(region.has(0)).toBe(false)
  })
})
