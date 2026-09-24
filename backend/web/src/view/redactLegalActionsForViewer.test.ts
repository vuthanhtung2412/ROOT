import { describe, expect, it } from 'vitest'
import type { ActionSpec } from '@root/lib'
import { createTwoPlayerGameState } from '#test/gameStateFixtures.js'
import { redactLegalActionsForViewer } from '#view/redactLegalActionsForViewer.js'

describe('redactLegalActionsForViewer', () => {
  it('keeps only viewer-seat actions so cardIds stay private', () => {
    const state = createTwoPlayerGameState([
      { playerId: 'marquise' },
      { playerId: 'eyrie' },
    ])
    const legalActions: ActionSpec[] = [
      {
        type: 'craft',
        actor: 0,
        params: { cardIds: ['secret-marquise-card'] },
      },
      {
        type: 'discard',
        actor: 1,
        params: { cardIds: ['secret-eyrie-card'] },
      },
    ]

    const forMarquise = redactLegalActionsForViewer(
      legalActions,
      state,
      'marquise',
    )
    const forEyrie = redactLegalActionsForViewer(
      legalActions,
      state,
      'eyrie',
    )

    expect(forMarquise).toEqual([legalActions[0]])
    expect(forEyrie).toEqual([legalActions[1]])
  })

  it('returns empty when viewer unknown', () => {
    const state = createTwoPlayerGameState([
      { playerId: 'marquise' },
      { playerId: 'eyrie' },
    ])
    const legalActions: ActionSpec[] = [{ type: 'endPhase', actor: 0 }]

    expect(
      redactLegalActionsForViewer(legalActions, state, 'vagabond'),
    ).toEqual([])
  })
})
