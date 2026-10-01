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
      { label: 'seat 0', value: 'seat:0' },
      { label: 'seat 1', value: 'seat:1' },
    ])
    expect(composer.chooseColumn('seat:1')).toEqual({
      kind: 'ready',
      action: { type: 'vbBattle', defender: 1 },
    })
  })

  it('aid picks card then defender, shown by faction name', () => {
    const factions = ['marquise', 'eyrie', 'alliance', 'vagabond']
    const vagabond = createVagabondComposerHooks({
      factionNameForSeat: (seat: number): string | null => factions[seat] ?? null,
    })
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
      { label: 'marquise', value: 'seat:0' },
      { label: 'alliance', value: 'seat:2' },
    ])
    expect(composer.chooseColumn('seat:2')).toEqual({
      kind: 'ready',
      action: { type: 'aid', cardId: 'ROOT-202#1', target: 2 },
    })
  })

  it('aid asks which item to exhaust when several types are available', () => {
    const vagabond = createVagabondComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(vagabond.hooks)

    composer.begin(
      makeActionSpec({
        type: 'aid',
        params: {
          cardIds: ['ROOT-203#1'],
          defender: [1],
          costItemTypes: ['boot', 'sword'],
        },
      }),
    )
    const afterCard = composer.chooseCard('ROOT-203#1')
    expect(afterCard).toMatchObject({
      kind: 'incomplete',
      prompt: { message: 'Aid — pick item to exhaust' },
    })
    expect(vagabond.getPromptOptions()).toEqual([
      {
        label: 'boot',
        value: 'cost:boot',
        item: { type: 'boot', exhausted: false, damaged: false, selected: false },
      },
      {
        label: 'sword',
        value: 'cost:sword',
        item: { type: 'sword', exhausted: false, damaged: false, selected: false },
      },
    ])
    expect(composer.chooseColumn('cost:sword')).toEqual({
      kind: 'ready',
      action: {
        type: 'aid',
        cardId: 'ROOT-203#1',
        target: 1,
        costItem: 'sword',
      },
    })
  })

  it('aid offers the target crafted items, or taking nothing', () => {
    const vagabond = createVagabondComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(vagabond.hooks)

    composer.begin(
      makeActionSpec({
        type: 'aid',
        params: {
          cardIds: ['ROOT-203#1'],
          defender: [1],
          costItemTypes: ['sword'],
          takeItemTypes: ['boot'],
        },
      }),
    )
    const afterCard = composer.chooseCard('ROOT-203#1')
    expect(afterCard).toMatchObject({
      kind: 'incomplete',
      prompt: { message: 'Aid — take a crafted item?' },
    })
    expect(vagabond.getPromptOptions()).toEqual([
      {
        label: 'take boot',
        value: 'take:boot',
        item: { type: 'boot', exhausted: false, damaged: false, selected: false },
      },
      { label: 'take nothing', value: 'take-nothing' },
    ])
    expect(composer.chooseColumn('take:boot')).toEqual({
      kind: 'ready',
      action: {
        type: 'aid',
        cardId: 'ROOT-203#1',
        target: 1,
        costItem: 'sword',
        takeItem: 'boot',
      },
    })
  })

  it('repair lists damaged items by name', () => {
    const vagabond = createVagabondComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(vagabond.hooks)

    const opened = composer.begin(
      makeActionSpec({
        type: 'repair',
        params: {
          clearings: [0, 1],
          vagabondItems: [
            { type: 'boot', exhausted: true, damaged: true },
            { type: 'torch', exhausted: false, damaged: true },
          ],
        },
      }),
    )
    expect(opened).toMatchObject({
      kind: 'incomplete',
      prompt: { message: 'Repair — pick damaged item', highlightClearings: [] },
    })
    expect(vagabond.getPromptOptions()).toEqual([
      {
        label: 'boot (exhausted)',
        value: 'repair:0',
        item: { type: 'boot', exhausted: true, damaged: true, selected: false },
      },
      {
        label: 'torch',
        value: 'repair:1',
        item: { type: 'torch', exhausted: false, damaged: true, selected: false },
      },
    ])
    expect(composer.chooseColumn('repair:1')).toEqual({
      kind: 'ready',
      action: { type: 'repair', itemIndex: 1 },
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
