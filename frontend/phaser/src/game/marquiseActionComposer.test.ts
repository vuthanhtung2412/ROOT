import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '../test/factories.ts'
import { ActionComposer } from './ActionComposer.ts'
import {
  createMarquiseBoardComposerHooks,
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
  it('prompts from → to → count then confirms single move', () => {
    const march = createMarquiseMarchComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(march.hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 0, to: 4, count: 1 },
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
      expect(afterTo.prompt.message).toContain('how many')
      expect(afterTo.prompt.canConfirm).toBe(false)
    }
    expect(march.getPromptOptions()).toEqual([
      { label: '1 warrior', value: '1' },
      { label: '2 warriors', value: '2' },
    ])

    const afterCount = composer.chooseColumn('1')
    expect(afterCount.kind).toBe('incomplete')
    if (afterCount.kind === 'incomplete') {
      expect(afterCount.prompt.canConfirm).toBe(true)
    }
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: { type: 'march', moves: [{ from: 0, to: 4, count: 1 }] },
    })
  })

  it('submits two moves after second count', () => {
    const march = createMarquiseMarchComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(march.hooks)

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
    composer.chooseColumn('2')
    composer.chooseClearing(4)
    composer.chooseClearing(9)
    expect(composer.chooseColumn('1')).toEqual({
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

describe('marquiseActionComposer board', () => {
  it('build emits paired clearing and building', () => {
    const { hooks } = createMarquiseBoardComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)

    composer.begin(
      makeActionSpec({
        type: 'build',
        params: {
          options: [{ clearing: 3, building: 'sawmill' }],
        },
      }),
    )
    expect(composer.chooseClearing(3)).toEqual({
      kind: 'ready',
      action: { type: 'build', clearing: 3, building: 'sawmill' },
    })
  })

  it('battle picks clearing then defender option', () => {
    const board = createMarquiseBoardComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(board.hooks)

    composer.begin(
      makeActionSpec({
        type: 'battle',
        params: {
          targets: [
            { clearing: 5, defender: 1 },
            { clearing: 5, defender: 2 },
          ],
        },
      }),
    )
    const mid = composer.chooseClearing(5)
    expect(mid.kind).toBe('incomplete')
    expect(board.getPromptOptions()).toEqual([
      { label: 'seat 1', value: '1' },
      { label: 'seat 2', value: '2' },
    ])
    expect(composer.chooseColumn('1')).toEqual({
      kind: 'ready',
      action: { type: 'battle', clearing: 5, defender: 1 },
    })
  })
})
