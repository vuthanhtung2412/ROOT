import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '../test/factories.ts'
import { ActionComposer } from './ActionComposer.ts'
import {
  createMarquiseCardComposerHooks,
  createMarquiseMarchComposerHooks,
} from './marquiseActionComposer.ts'

describe('marquiseActionComposer cards', () => {
  it('overwork pairs card then clearing', () => {
    const { hooks } = createMarquiseCardComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)

    const begin = composer.begin(
      makeActionSpec({
        type: 'overwork',
        params: {
          options: [
            { cardId: 'ROOT-205#1', clearing: 4 },
            { cardId: 'ROOT-206#1', clearing: 7 },
          ],
        },
      }),
    )
    expect(begin.kind).toBe('incomplete')

    const afterCard = composer.chooseCard('ROOT-205#1')
    expect(afterCard.kind).toBe('incomplete')
    if (afterCard.kind === 'incomplete') {
      expect(afterCard.prompt.highlightClearings).toEqual([4])
    }

    expect(composer.chooseClearing(4)).toEqual({
      kind: 'ready',
      action: { type: 'overwork', cardId: 'ROOT-205#1', clearing: 4 },
    })
  })

  it('discard accumulates cards then confirms', () => {
    const { hooks } = createMarquiseCardComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)

    composer.begin(
      makeActionSpec({
        type: 'discard',
        params: { cardIds: ['a', 'b', 'c'] },
      }),
    )
    composer.chooseCard('a')
    const afterSecond = composer.chooseCard('c')
    expect(afterSecond.kind).toBe('incomplete')
    if (afterSecond.kind === 'incomplete') {
      expect(afterSecond.prompt.canConfirm).toBe(true)
    }
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: { type: 'discard', cardIds: ['a', 'c'] },
    })
  })
})

describe('marquiseActionComposer march', () => {
  it('confirms single move', () => {
    const { hooks } = createMarquiseMarchComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 0, to: 4, count: 2 },
            { from: 4, to: 9, count: 1 },
          ],
        },
      }),
    )
    composer.chooseClearing(0)
    const afterTo = composer.chooseClearing(4)
    expect(afterTo.kind).toBe('incomplete')
    if (afterTo.kind === 'incomplete') {
      expect(afterTo.prompt.canConfirm).toBe(true)
    }
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: { type: 'march', moves: [{ from: 0, to: 4, count: 2 }] },
    })
  })

  it('submits two moves without confirm on second', () => {
    const { hooks } = createMarquiseMarchComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 0, to: 4, count: 2 },
            { from: 4, to: 9, count: 1 },
          ],
        },
      }),
    )
    composer.chooseClearing(0)
    composer.chooseClearing(4)
    composer.chooseClearing(4)
    expect(composer.chooseClearing(9)).toEqual({
      kind: 'ready',
      action: {
        type: 'march',
        moves: [
          { from: 0, to: 4, count: 2 },
          { from: 4, to: 9, count: 1 },
        ],
      },
    })
  })
})
