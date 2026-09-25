import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import { ActionComposer, readChoiceParams } from '#game/resolution/ActionComposer.ts'

describe('ActionComposer', () => {
  it('endPhase is immediately ready', () => {
    const composer = new ActionComposer()
    const outcome = composer.begin(makeActionSpec({ type: 'endPhase' }))
    expect(outcome).toEqual({
      kind: 'ready',
      action: { type: 'endPhase' },
    })
  })

  it('craft waits for card then emits action', () => {
    const composer = new ActionComposer()
    const incomplete = composer.begin(
      makeActionSpec({
        type: 'craft',
        params: { cardIds: ['ROOT-205#1', 'ROOT-206#1'] },
      }),
    )
    expect(incomplete.kind).toBe('incomplete')
    if (incomplete.kind !== 'incomplete') {
      return
    }
    expect(incomplete.prompt.enabledCardIds).toEqual([
      'ROOT-205#1',
      'ROOT-206#1',
    ])

    const ready = composer.chooseCard('ROOT-205#1')
    expect(ready).toEqual({
      kind: 'ready',
      action: { type: 'craft', cardId: 'ROOT-205#1' },
    })
  })

  it('cancel returns to idle', () => {
    const composer = new ActionComposer()
    composer.begin(
      makeActionSpec({
        type: 'spendBird',
        params: { cardIds: ['ROOT-200#1'] },
      }),
    )
    expect(composer.cancel()).toEqual({ kind: 'idle' })
    expect(composer.getActiveSpec()).toBeNull()
  })

  it('hooks can override begin', () => {
    const composer = new ActionComposer()
    composer.setHooks({
      begin: () => ({
        kind: 'ready',
        action: { type: 'recruit' },
      }),
    })
    expect(composer.begin(makeActionSpec({ type: 'march' }))).toEqual({
      kind: 'ready',
      action: { type: 'recruit' },
    })
  })

  it('readChoiceParams guards unknown shapes', () => {
    const params = readChoiceParams(
      makeActionSpec({
        type: 'battle',
        params: {
          targets: [{ clearing: 3, defender: 1 }],
          cardIds: ['x'],
        },
      }),
    )
    expect(params.targets).toEqual([{ clearing: 3, defender: 1 }])
    expect(params.cardIds).toEqual(['x'])
  })
})
