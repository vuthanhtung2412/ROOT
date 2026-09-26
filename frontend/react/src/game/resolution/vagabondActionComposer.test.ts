import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import { ActionComposer } from '#game/resolution/ActionComposer.ts'
import { createVagabondComposerHooks } from '#game/resolution/vagabondActionComposer.ts'

describe('vagabondActionComposer multi-target', () => {
  it('battle merges defenders then picks via column', () => {
    const vagabond = createVagabondComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(vagabond.hooks)

    composer.begin(
      makeActionSpec({
        type: 'vbBattle',
        params: {
          targets: [
            { clearing: 5, defender: 0 },
            { clearing: 5, defender: 1 },
          ],
        },
      }),
    )
    const mid = composer.chooseClearing(5)
    expect(mid.kind).toBe('incomplete')
    expect(vagabond.getPromptOptions()).toEqual([
      { label: 'seat 0', value: '0' },
      { label: 'seat 1', value: '1' },
    ])
    expect(composer.chooseColumn('1')).toEqual({
      kind: 'ready',
      action: { type: 'vbBattle', defender: 1 },
    })
  })

  it('aid picks card then defender when multiple targets', () => {
    const vagabond = createVagabondComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(vagabond.hooks)

    composer.begin(
      makeActionSpec({
        type: 'aid',
        params: {
          cardIds: ['ROOT-202#1'],
          defender: [0, 2],
        },
      }),
    )
    const afterCard = composer.chooseCard('ROOT-202#1')
    expect(afterCard.kind).toBe('incomplete')
    expect(vagabond.getPromptOptions()).toEqual([
      { label: 'seat 0', value: '0' },
      { label: 'seat 2', value: '2' },
    ])
    expect(composer.chooseColumn('2')).toEqual({
      kind: 'ready',
      action: { type: 'aid', cardId: 'ROOT-202#1', target: 2 },
    })
  })

  it('steal with one defender is ready immediately', () => {
    const vagabond = createVagabondComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(vagabond.hooks)

    expect(
      composer.begin(
        makeActionSpec({
          type: 'steal',
          params: { defender: [1] },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: { type: 'steal', target: 1 },
    })
  })
})
