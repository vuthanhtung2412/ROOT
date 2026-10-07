import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import { ActionComposer } from '#game/resolution/ActionComposer.ts'
import {
  createMarquiseBoardComposerHooks,
  createMarquiseCardComposerHooks,
} from '#game/resolution/marquiseActionComposer.ts'

/** Two over the five-card hand limit. */
const SEVEN_CARD_HAND = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

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
        params: { cardIds: SEVEN_CARD_HAND },
      }),
    )
    const afterFirst = composer.chooseCard('a')
    expect(afterFirst).toMatchObject({
      kind: 'incomplete',
      prompt: {
        message: 'Discard 1/2 card(s) — Confirm when ready',
        canConfirm: false,
      },
    })
    expect(composer.confirm().kind).not.toBe('ready')
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

  it('Law Evening: discard until five — a third card is not picked with 7 in hand', () => {
    const cards = createMarquiseCardComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(cards.hooks)
    composer.begin(
      makeActionSpec({ type: 'discard', params: { cardIds: SEVEN_CARD_HAND } }),
    )
    const afterFirst = composer.chooseCard('a')
    // Still short: every card of the hand can be picked.
    expect(afterFirst).toMatchObject({
      prompt: { enabledCardIds: SEVEN_CARD_HAND, canConfirm: false },
    })
    composer.chooseCard('b')

    const afterThird = composer.chooseCard('c')

    // Enough picked: only the picked cards stay lit, the rest dim.
    expect(afterThird).toMatchObject({
      kind: 'incomplete',
      prompt: { canConfirm: true, enabledCardIds: ['a', 'b'] },
    })
    // Putting one back lights the whole hand again.
    expect(composer.chooseCard('a')).toMatchObject({
      prompt: { enabledCardIds: SEVEN_CARD_HAND, canConfirm: false },
    })
    composer.chooseCard('a')
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: { type: 'discard', cardIds: ['b', 'a'] },
    })
  })

  it('cancel when idle returns null so merge reaches other hooks', () => {
    const { hooks } = createMarquiseCardComposerHooks()
    expect(hooks.cancel?.()).toBeNull()
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
      { label: 'seat 1', value: 'seat:1' },
      { label: 'seat 2', value: 'seat:2' },
    ])
    expect(composer.chooseColumn('seat:1')).toEqual({
      kind: 'ready',
      action: { type: 'battle', clearing: 5, defender: 1 },
    })
  })

  it('battle names each defender by faction', () => {
    const factions: readonly string[] = ['marquise', 'riverfolk', 'lizard']
    const board = createMarquiseBoardComposerHooks({
      factionNameForSeat: (seat: number): string | null => factions[seat] ?? null,
    })
    const composer = new ActionComposer()
    composer.setHooks(board.hooks)

    composer.begin(
      makeActionSpec({
        type: 'battle',
        params: {
          targets: [
            { clearing: 4, defender: 2 },
            { clearing: 4, defender: 1 },
          ],
        },
      }),
    )
    composer.chooseClearing(4)
    expect(board.getPromptOptions()).toEqual([
      { label: 'lizard', value: 'seat:2' },
      { label: 'riverfolk', value: 'seat:1' },
    ])
  })
})
