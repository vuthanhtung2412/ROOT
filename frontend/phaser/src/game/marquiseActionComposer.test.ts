import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import { ActionComposer } from '#game/ActionComposer.ts'
import {
  createMarquiseBoardComposerHooks,
  createMarquiseCardComposerHooks,
  createMarquiseMarchComposerHooks,
} from '#game/marquiseActionComposer.ts'

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
    const cards = createMarquiseCardComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(cards.hooks)

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
    const draft = cards.getDraft()
    expect(draft.type).toBe('discardMany')
    if (draft.type === 'discardMany') {
      expect(draft.selected).toEqual(['a', 'c'])
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
      { label: '1 x warriors', value: '1' },
      { label: '2 x warriors', value: '2' },
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
            { from: 4, to: 1, count: 1 },
          ],
        },
      }),
    )
    composer.chooseClearing(0)
    composer.chooseClearing(4)
    composer.chooseColumn('2')
    composer.chooseClearing(4)
    composer.chooseClearing(1)
    expect(composer.chooseColumn('1')).toEqual({
      kind: 'ready',
      action: {
        type: 'march',
        moves: [
          { from: 0, to: 4, count: 2 },
          { from: 4, to: 1, count: 1 },
        ],
      },
    })
  })

  it('second move can take warriors that arrived on first', () => {
    // C1:1, C5:1 → C1→C5 (1), C5→C10 (2)
    const march = createMarquiseMarchComposerHooks({
      warriorCountsForCurrentSeat: () =>
        new Map([
          [1, 1],
          [5, 1],
        ]),
    })
    const composer = new ActionComposer()
    composer.setHooks(march.hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 1, to: 5, count: 1 },
            { from: 5, to: 10, count: 1 },
            { from: 5, to: 1, count: 1 },
          ],
        },
      }),
    )
    composer.chooseClearing(1)
    composer.chooseClearing(5)
    composer.chooseColumn('1')
    composer.chooseClearing(5)
    composer.chooseClearing(10)
    expect(march.getPromptOptions()).toEqual([
      { label: '1 x warriors', value: '1' },
      { label: '2 x warriors', value: '2' },
    ])
    expect(composer.chooseColumn('2')).toEqual({
      kind: 'ready',
      action: {
        type: 'march',
        moves: [
          { from: 1, to: 5, count: 1 },
          { from: 5, to: 10, count: 2 },
        ],
      },
    })
  })

  it('Rule: 4.2.1 — after move into contested clearing, dest not 2nd origin', () => {
    // C2:2 Marquise, C6:2 Eyrie → march C2→C6 (2); Eyrie rules C6 (Lords).
    const clearings = Array.from({ length: 12 }, () => ({ pieces: [] as Array<{
      id: string
      kind: string
      owner: number
    }> }))
    clearings[2] = {
      pieces: [
        { id: 'm1', kind: 'warrior', owner: 0 },
        { id: 'm2', kind: 'warrior', owner: 0 },
      ],
    }
    clearings[6] = {
      pieces: [
        { id: 'e1', kind: 'warrior', owner: 1 },
        { id: 'e2', kind: 'warrior', owner: 1 },
      ],
    }
    const march = createMarquiseMarchComposerHooks({
      warriorCountsForCurrentSeat: () => new Map([[2, 2]]),
      boardForMarch: () => ({
        clearings,
        factions: ['marquise', 'eyrie'],
        seat: 0,
      }),
    })
    const composer = new ActionComposer()
    composer.setHooks(march.hooks)

    composer.begin(
      makeActionSpec({
        type: 'march',
        params: {
          moves: [
            { from: 2, to: 6, count: 1 },
            { from: 2, to: 6, count: 2 },
          ],
        },
      }),
    )
    composer.chooseClearing(2)
    composer.chooseClearing(6)
    const afterFirst = composer.chooseColumn('2')
    expect(afterFirst.kind).toBe('incomplete')
    if (afterFirst.kind === 'incomplete') {
      expect(afterFirst.prompt.highlightClearings).not.toContain(6)
      expect(afterFirst.prompt.canConfirm).toBe(true)
    }
    // Ignored click: ActionComposer keeps prior incomplete outcome
    const ignored = composer.chooseClearing(6)
    expect(ignored.kind).toBe('incomplete')
    if (ignored.kind === 'incomplete') {
      expect(ignored.prompt.message).toContain('Confirm, or pick 2nd origin')
      expect(ignored.prompt.highlightClearings).not.toContain(6)
    }
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
