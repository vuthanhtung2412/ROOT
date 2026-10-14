import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import { ActionComposer } from '#game/resolution/ActionComposer.ts'
import { createEyrieComposerHooks } from '#game/resolution/eyrieActionComposer.ts'

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

  it('addToDecree sends nothing before confirm, even with two cards staged', () => {
    const eyrie = createEyrieComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(eyrie.hooks)
    composer.begin(
      makeActionSpec({
        type: 'addToDecree',
        params: {
          options: [
            { cardId: 'c1', column: 'recruit' },
            { cardId: 'c2', column: 'battle' },
          ],
          birdCardIds: [],
        },
      }),
    )

    composer.chooseCard('c1')
    composer.chooseColumn('recruit')
    composer.chooseCard('c2')
    const afterSecondCard = composer.chooseColumn('battle')

    expect(afterSecondCard.kind).toBe('incomplete')
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: {
        type: 'addToDecree',
        cards: [
          { cardId: 'c1', column: 'recruit' },
          { cardId: 'c2', column: 'battle' },
        ],
      },
    })
  })

  it('addToDecree panel lays, moves and takes back a card without a pick', () => {
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

    eyrie.decreeStaging.stage({ cardId: 'c1', column: 'recruit' })
    eyrie.decreeStaging.stage({ cardId: 'c1', column: 'move' })
    eyrie.decreeStaging.stage({ cardId: 'c2', column: 'battle' })
    eyrie.decreeStaging.takeBack('c2')

    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: {
        type: 'addToDecree',
        cards: [{ cardId: 'c1', column: 'move' }],
      },
    })
  })

  it('addToDecree staging is null when no Add to Decree is staged', () => {
    const eyrie = createEyrieComposerHooks()

    expect(eyrie.decreeStaging.clear()).toBeNull()
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

  it('decree recruit with one clearing auto-submits', () => {
    const { hooks } = createEyrieComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)
    expect(
      composer.begin(
        makeActionSpec({
          type: 'decree',
          params: {
            column: ['recruit'],
            cardIds: ['vizier'],
            clearings: [3],
          },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: {
        type: 'decree',
        column: 'recruit',
        cardId: 'vizier',
        clearing: 3,
      },
    })
  })

  it('decree battle with one target auto-submits', () => {
    const { hooks } = createEyrieComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)
    expect(
      composer.begin(
        makeActionSpec({
          type: 'decree',
          params: {
            column: ['battle'],
            cardIds: ['vizier'],
            targets: [{ clearing: 4, defender: 0 }],
          },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: {
        type: 'decree',
        column: 'battle',
        cardId: 'vizier',
        clearing: 4,
        defender: 0,
      },
    })
  })

  it('decree move with one march auto-submits', () => {
    const { hooks } = createEyrieComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)
    expect(
      composer.begin(
        makeActionSpec({
          type: 'decree',
          params: {
            column: ['move'],
            cardIds: ['vizier'],
            moves: [{ from: 1, to: 2, count: 1 }],
          },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: {
        type: 'decree',
        column: 'move',
        cardId: 'vizier',
        moves: [{ from: 1, to: 2, count: 1 }],
      },
    })
  })

  it('decree battle picks clearing then defender', () => {
    const { hooks } = createEyrieComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(hooks)
    composer.begin(
      makeActionSpec({
        type: 'decree',
        params: {
          column: ['battle'],
          cardIds: ['vizier'],
          targets: [
            { clearing: 4, defender: 0 },
            { clearing: 4, defender: 2 },
          ],
        },
      }),
    )
    const mid = composer.chooseClearing(4)
    expect(mid.kind).toBe('incomplete')
    expect(composer.chooseColumn('seat:0')).toEqual({
      kind: 'ready',
      action: {
        type: 'decree',
        column: 'battle',
        cardId: 'vizier',
        clearing: 4,
        defender: 0,
      },
    })
  })

  it('decree move picks from → to → count', () => {
    const eyrie = createEyrieComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(eyrie.hooks)
    composer.begin(
      makeActionSpec({
        type: 'decree',
        params: {
          column: ['move'],
          cardIds: ['vizier'],
          moves: [
            { from: 1, to: 2, count: 1 },
            { from: 1, to: 2, count: 2 },
            { from: 1, to: 3, count: 1 },
          ],
        },
      }),
    )
    composer.chooseClearing(1)
    const afterTo = composer.chooseClearing(2)
    expect(afterTo.kind).toBe('incomplete')
    if (afterTo.kind === 'incomplete') {
      expect(afterTo.prompt.message).toContain('how many')
    }
    expect(eyrie.getPromptOptions()).toEqual([
      { label: '1 x warriors', value: '1' },
      { label: '2 x warriors', value: '2' },
    ])
    expect(composer.chooseColumn('2')).toEqual({
      kind: 'ready',
      action: {
        type: 'decree',
        column: 'move',
        cardId: 'vizier',
        moves: [{ from: 1, to: 2, count: 2 }],
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
