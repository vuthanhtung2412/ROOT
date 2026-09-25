import { describe, expect, it } from 'vitest'
import { soleEndPhaseAction } from '#game/resolution/forcedAction.ts'
import { makeActionSpec } from '#test/factories.ts'

describe('soleEndPhaseAction', () => {
  it('returns endPhase when it is the only actor action', () => {
    expect(
      soleEndPhaseAction(
        [makeActionSpec({ type: 'endPhase', actor: 0 })],
        0,
      ),
    ).toEqual(makeActionSpec({ type: 'endPhase', actor: 0 }))
  })

  it('returns null when other actions exist', () => {
    expect(
      soleEndPhaseAction(
        [
          makeActionSpec({ type: 'endPhase', actor: 0 }),
          makeActionSpec({ type: 'craft', actor: 0 }),
        ],
        0,
      ),
    ).toBeNull()
  })

  it('ignores other seats', () => {
    expect(
      soleEndPhaseAction(
        [makeActionSpec({ type: 'endPhase', actor: 1 })],
        0,
      ),
    ).toBeNull()
  })
})
