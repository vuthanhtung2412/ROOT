import { describe, expect, it } from 'vitest'
import {
  ActionComposer,
  type ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'
import { createEventComposerHooks } from '#game/resolution/eventActionComposer.ts'
import { mergeComposerHooks } from '#game/resolution/mergeComposerHooks.ts'
import { createOptionComposerHooks } from '#game/resolution/optionActionComposer.ts'
import { makeActionSpec, makeGameState } from '#test/factories.ts'
import { formatActionLabel } from '#ui/ActionTray.ts'
import { buildTurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'

const FOX_CARD_ID = 'ROOT-204#1'
const RABBIT_CARD_ID = 'ROOT-206#1'

type ComposerUnderTest = {
  composer: ActionComposer
  option: ReturnType<typeof createOptionComposerHooks>
}

function composerFor(pendingType: string | null = null): ComposerUnderTest {
  const option = createOptionComposerHooks({
    factionNameForSeat: (seat: number): string | null =>
      ['marquise', 'riverfolk', 'eyrie'][seat] ?? null,
    pendingType: (): string | null => pendingType,
  })
  const composer = new ActionComposer()
  composer.setHooks(
    mergeComposerHooks(option.hooks, createEventComposerHooks().hooks),
  )
  return { composer, option }
}

function expectIncomplete(
  outcome: ComposerOutcome,
): Extract<ComposerOutcome, { kind: 'incomplete' }> {
  if (outcome.kind !== 'incomplete') {
    throw new Error(`expected incomplete, got ${outcome.kind}`)
  }
  return outcome
}

describe('optionActionComposer turn actions', () => {
  it('ritual: picks the card, then a clearing that card allows', () => {
    const { composer } = composerFor()
    const begun = expectIncomplete(
      composer.begin(
        makeActionSpec({
          type: 'ritualRecruit',
          params: {
            options: [
              { cardId: FOX_CARD_ID, clearing: 0 },
              { cardId: FOX_CARD_ID, clearing: 5 },
              { cardId: RABBIT_CARD_ID, clearing: 4 },
            ],
          },
        }),
      ),
    )
    expect(begun.prompt.enabledCardIds).toEqual([FOX_CARD_ID, RABBIT_CARD_ID])

    const afterCard = expectIncomplete(composer.chooseCard(FOX_CARD_ID))
    expect(afterCard.prompt.highlightClearings).toEqual([0, 5])
    expect(composer.chooseClearing(4).kind).toBe('incomplete')

    expect(composer.chooseClearing(5)).toEqual({
      kind: 'ready',
      action: { type: 'ritualRecruit', cardId: FOX_CARD_ID, clearing: 5 },
    })
  })

  it('skips every step that has a single possible value', () => {
    const { composer } = composerFor()
    expect(
      composer.begin(
        makeActionSpec({
          type: 'riverfolkDraw',
          params: { options: [{ fundOwner: 1 }] },
        }),
      ),
    ).toEqual({ kind: 'ready', action: { type: 'riverfolkDraw', fundOwner: 1 } })
  })

  it('move: origin, destination, count on the stepper, then the fund', () => {
    const { composer, option } = composerFor()
    const options = [1, 2].flatMap((count) =>
      [0, 1].map((fundOwner) => ({ from: 4, to: 9, count, fundOwner })),
    )
    composer.begin(makeActionSpec({ type: 'riverfolkMove', params: { options } }))
    expect(option.getPromptOptions()).toEqual([
      { label: '1 warrior', value: '1' },
      { label: '2 warriors', value: '2' },
    ])

    composer.chooseColumn('2')
    expect(option.getPromptOptions()).toEqual([
      { label: 'marquise fund', value: 'choice:0' },
      { label: 'riverfolk fund', value: 'choice:1' },
    ])
    expect(composer.chooseColumn('choice:0')).toEqual({
      kind: 'ready',
      action: {
        type: 'riverfolkMove',
        from: 4,
        to: 9,
        count: 2,
        fundOwner: 0,
      },
    })
  })

  it('cancel returns to idle', () => {
    const { composer, option } = composerFor()
    composer.begin(
      makeActionSpec({
        type: 'convert',
        params: {
          options: [
            { clearing: 0, target: 0 },
            { clearing: 5, target: 2 },
          ],
        },
      }),
    )
    expect(option.getDraft().type).toBe('optionAction')
    expect(composer.cancel()).toEqual({ kind: 'idle' })
    expect(option.getDraft().type).toBe('idle')
  })
})

describe('optionActionComposer pending events', () => {
  it('Lizard Cult corner: asks even with one legal corner; cannot be cancelled', () => {
    const { composer } = composerFor('chooseCultCorner')
    const begun = expectIncomplete(
      composer.begin(
        makeActionSpec({ type: 'resolveEvent', params: { clearing: [2] } }),
      ),
    )
    expect(begun.prompt.message).toBe('Lizard Cult — choose starting corner')
    expect(begun.prompt.highlightClearings).toEqual([2])
    expect(begun.prompt.canCancel).toBe(false)
    expect(composer.cancel().kind).toBe('incomplete')
    expect(composer.chooseClearing(2)).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', clearing: 2 },
    })
  })

  it('Outcast suit and starting cost are picked from banner buttons', () => {
    const outcast = composerFor('chooseOutcast')
    outcast.composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: { suits: ['fox', 'rabbit', 'mouse'] },
      }),
    )
    expect(outcast.composer.chooseColumn('choice:1')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', suit: 'rabbit' },
    })

    const cost = composerFor('setStartingCost')
    const begun = expectIncomplete(
      cost.composer.begin(
        makeActionSpec({
          type: 'resolveEvent',
          params: { services: ['riverboats'], costs: [1, 2, 3, 4] },
        }),
      ),
    )
    expect(begun.prompt.message).toContain('Riverboats')
    expect(cost.option.getPromptOptions()[3]).toEqual({
      label: 'Cost 4',
      value: 'choice:3',
    })
    expect(cost.composer.chooseColumn('choice:3')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', cost: 4 },
    })
  })

  it('buy services: Hand Card is picked from the shown Riverfolk hand', () => {
    const { composer, option } = composerFor('buyServices')
    composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: {
          options: [
            { service: 'handCard', cardId: FOX_CARD_ID },
            { service: 'handCard', cardId: RABBIT_CARD_ID },
            { service: 'riverboats' },
          ],
        },
      }),
    )
    expect(option.getPromptOptions().map((entry) => entry.label)).toEqual([
      'Hand Card',
      'Riverboats',
    ])
    composer.chooseColumn('choice:0')
    expect(option.getCardPilePick()?.cards.map((card) => card.id)).toEqual([
      FOX_CARD_ID,
      RABBIT_CARD_ID,
    ])
    expect(composer.chooseCard(RABBIT_CARD_ID)).toEqual({
      kind: 'ready',
      action: {
        type: 'resolveEvent',
        service: 'handCard',
        cardId: RABBIT_CARD_ID,
      },
    })
    expect(option.getCardPilePick()).toBeNull()
  })

  it('buy services: a service without a card is bought at once; decline still works', () => {
    const { composer } = composerFor('buyServices')
    composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: { options: [{ service: 'riverboats' }, { service: 'mercenaries' }] },
      }),
    )
    expect(composer.chooseColumn('choice:1')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', service: 'mercenaries' },
    })
    expect(
      composer.begin(
        makeActionSpec({ type: 'resolveEvent', params: { decline: [true] } }),
      ),
    ).toEqual({ kind: 'ready', action: { type: 'resolveEvent', decline: true } })
  })

  it('leaves other pending events to the event composer', () => {
    const { composer, option } = composerFor('chooseKeep')
    const begun = expectIncomplete(
      composer.begin(
        makeActionSpec({ type: 'resolveEvent', params: { clearing: [0, 1] } }),
      ),
    )
    expect(begun.prompt.message).toBe('Choose keep corner')
    expect(option.getDraft().type).toBe('idle')
  })
})

describe('expansion tray labels and banner prompts', () => {
  it('labels the services offer by its pending event', () => {
    const pending = { type: 'buyServices', buyer: 0, bought: 0 }
    expect(
      formatActionLabel(
        makeActionSpec({
          type: 'resolveEvent',
          params: { options: [{ service: 'riverboats' }] },
        }),
        pending,
      ),
    ).toBe('buy service')
    expect(
      formatActionLabel(
        makeActionSpec({ type: 'resolveEvent', params: { decline: [true] } }),
        pending,
      ),
    ).toBe('no service')
    expect(formatActionLabel(makeActionSpec({ type: 'ritualScore' }))).toBe(
      'score',
    )
  })

  it('prompts for expansion setup and service events', () => {
    const setup = makeGameState({
      status: 'setup',
      pending: [{ type: 'chooseOutcast', seat: 1 }],
    })
    expect(buildTurnBannerViewModel(setup).prompt).toBe(
      'Lizard Cult — choose the Outcast suit',
    )
    const buying = makeGameState({
      pending: [{ type: 'buyServices', buyer: 0, bought: 0 }],
    })
    expect(
      buildTurnBannerViewModel(buying, [
        makeActionSpec({ type: 'resolveEvent', actor: 0 }),
      ]).prompt,
    ).toBe('Riverfolk services — buy or decline')
  })
})
