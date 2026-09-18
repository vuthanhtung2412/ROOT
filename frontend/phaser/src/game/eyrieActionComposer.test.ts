import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '../test/factories.ts'
import { ActionComposer } from './ActionComposer.ts'
import { createEyrieComposerHooks } from './eyrieActionComposer.ts'

describe('eyrieActionComposer', () => {
  it('addToDecree forces card×column then confirm', () => {
    const eyrie = createEyrieComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(eyrie.hooks)

    composer.begin(
      makeActionSpec({
        type: 'addToDecree',
        params: {
          options: [
            { cardId: 'c1', column: 'recruit' },
            { cardId: 'c1', column: 'move' },
            { cardId: 'c2', column: 'battle' },
          ],
          birdCardIds: [],
        },
      }),
    )
    composer.chooseCard('c1')
    const afterColumn = composer.chooseColumn('recruit')
    expect(afterColumn.kind).toBe('incomplete')
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: {
        type: 'addToDecree',
        cards: [{ cardId: 'c1', column: 'recruit' }],
      },
    })
  })

  it('newRoost picks clearing', () => {
    const { hooks } = createEyrieComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)
    composer.begin(
      makeActionSpec({
        type: 'newRoost',
        params: { clearings: [2, 6] },
      }),
    )
    expect(composer.chooseClearing(6)).toEqual({
      kind: 'ready',
      action: { type: 'newRoost', clearing: 6 },
    })
  })

  it('decree recruit needs clearing', () => {
    const { hooks } = createEyrieComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)
    composer.begin(
      makeActionSpec({
        type: 'decree',
        params: {
          column: ['recruit'],
          cardIds: ['vizier'],
          clearings: [0, 1],
        },
      }),
    )
    expect(composer.chooseClearing(1)).toEqual({
      kind: 'ready',
      action: {
        type: 'decree',
        column: 'recruit',
        cardId: 'vizier',
        clearing: 1,
      },
    })
  })

  it('turmoil stays immediate via core', () => {
    const composer = new ActionComposer()
    expect(composer.begin(makeActionSpec({ type: 'turmoil' }))).toEqual({
      kind: 'ready',
      action: { type: 'turmoil' },
    })
  })
})
