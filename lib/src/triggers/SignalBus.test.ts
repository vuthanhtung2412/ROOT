import { describe, expect, it } from 'vitest'
import type { Ctx } from '../game/ctx.js'
import { FALL } from '../map/fall.js'
import { SeededRng } from '../rules/Rng.js'
import { minimalState } from '../test/fixtures.js'
import { defaultRuleHooks } from './hooks.js'
import { SignalBus } from './SignalBus.js'

describe('SignalBus', () => {
  it('sync emit to listeners', () => {
    const bus = new SignalBus()
    const received: string[] = []
    bus.subscribe((_state, signal) => {
      received.push(signal.s)
    })

    const state = minimalState()
    const ctx: Ctx = {
      map: FALL,
      rng: new SeededRng({ seed: 1, cursor: 0 }),
      emit: () => {},
      hooks: defaultRuleHooks(FALL),
      grantedActions: () => [],
    }

    bus.emit(state, { s: 'draw', actor: 0, count: 1 }, ctx)
    bus.emit(state, { s: 'vp', actor: 0, delta: 2 }, ctx)

    expect(received).toEqual(['draw', 'vp'])
  })
})
