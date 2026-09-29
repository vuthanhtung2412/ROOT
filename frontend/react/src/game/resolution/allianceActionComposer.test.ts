import { describe, expect, it } from 'vitest'
import { ActionComposer } from '#game/resolution/ActionComposer.ts'
import { createAllianceComposerHooks } from '#game/resolution/allianceActionComposer.ts'
import { makeActionSpec } from '#test/factories.ts'

describe('allianceActionComposer spreadSympathy', () => {
  it('picks clearing then supporter cards, confirm to submit', () => {
    const alliance = createAllianceComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(alliance.hooks)

    const mouseClearing = 1
    const foxClearing = 0
    const mid = composer.begin(
      makeActionSpec({
        type: 'spreadSympathy',
        params: {
          options: [
            { clearing: mouseClearing, supporterIds: ['ROOT-84#1'] },
            { clearing: mouseClearing, supporterIds: ['ROOT-57#1'] },
            { clearing: foxClearing, supporterIds: ['ROOT-57#1'] },
            { clearing: foxClearing, supporterIds: ['ROOT-57#2'] },
          ],
        },
      }),
    )
    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') throw new Error('expected incomplete')
    expect(mid.prompt.highlightClearings).toEqual(
      expect.arrayContaining([mouseClearing, foxClearing]),
    )
    expect(alliance.getSupporterPilePick()).toBeNull()

    const afterClearing = composer.chooseClearing(mouseClearing)
    expect(afterClearing.kind).toBe('incomplete')
    if (afterClearing.kind !== 'incomplete') throw new Error('expected incomplete')
    expect(afterClearing.prompt.message).toBe(
      'Choose 1 mouse supporter to discard',
    )
    expect(afterClearing.prompt.canConfirm).toBe(false)
    expect(alliance.getSupporterPilePick()).toEqual({
      title: 'Choose 1 mouse supporter to discard',
      cards: [
        { id: 'ROOT-84#1', defId: 'ROOT-84' },
        { id: 'ROOT-57#1', defId: 'ROOT-57' },
      ],
      selectedCardIds: [],
    })

    const afterTap = composer.chooseCard('ROOT-84#1')
    expect(afterTap).toMatchObject({
      kind: 'incomplete',
      prompt: {
        message: 'Choose 1 mouse supporter to discard — Confirm when ready',
        canConfirm: true,
        canCancel: true,
      },
    })
    expect(alliance.getSupporterPilePick()?.selectedCardIds).toEqual([
      'ROOT-84#1',
    ])

    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: {
        type: 'spreadSympathy',
        clearing: mouseClearing,
        supporterIds: ['ROOT-84#1'],
      },
    })
  })

  it('titles supporter pick as Choose N suit supporters to discard', () => {
    const alliance = createAllianceComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(alliance.hooks)

    composer.begin(
      makeActionSpec({
        type: 'revolt',
        params: {
          options: [
            { clearing: 0, supporterIds: ['ROOT-72#1', 'ROOT-57#1'] },
            { clearing: 0, supporterIds: ['ROOT-72#1', 'ROOT-57#2'] },
          ],
        },
      }),
    )
    const afterClearing = composer.chooseClearing(0)
    expect(afterClearing).toMatchObject({
      kind: 'incomplete',
      prompt: { message: 'Choose 2 fox supporters to discard' },
    })
    expect(alliance.getSupporterPilePick()?.cards.map((card) => card.id)).toEqual(
      ['ROOT-72#1', 'ROOT-57#1', 'ROOT-57#2'],
    )
  })

  it('single option still requires card pick + confirm (no auto-submit)', () => {
    const alliance = createAllianceComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(alliance.hooks)

    const began = composer.begin(
      makeActionSpec({
        type: 'spreadSympathy',
        params: {
          options: [{ clearing: 1, supporterIds: ['ROOT-57#1'] }],
        },
      }),
    )
    expect(began).toMatchObject({
      kind: 'incomplete',
      prompt: {
        message: 'Choose 1 mouse supporter to discard',
        canConfirm: false,
        canCancel: true,
      },
    })
    expect(alliance.getSupporterPilePick()?.cards).toEqual([
      { id: 'ROOT-57#1', defId: 'ROOT-57' },
    ])

    composer.chooseCard('ROOT-57#1')
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: {
        type: 'spreadSympathy',
        clearing: 1,
        supporterIds: ['ROOT-57#1'],
      },
    })
  })

  it('cancel aborts supporter pick', () => {
    const alliance = createAllianceComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(alliance.hooks)

    composer.begin(
      makeActionSpec({
        type: 'spreadSympathy',
        params: {
          options: [{ clearing: 1, supporterIds: ['ROOT-57#1'] }],
        },
      }),
    )
    composer.chooseCard('ROOT-57#1')
    expect(composer.cancel()).toEqual({ kind: 'idle' })
    expect(alliance.getSupporterPilePick()).toBeNull()
  })

  it('confirm blocked until cost cards selected', () => {
    const alliance = createAllianceComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(alliance.hooks)

    composer.begin(
      makeActionSpec({
        type: 'revolt',
        params: {
          options: [
            { clearing: 0, supporterIds: ['ROOT-72#1', 'ROOT-57#1'] },
          ],
        },
      }),
    )
    expect(composer.confirm().kind).toBe('incomplete')
    composer.chooseCard('ROOT-72#1')
    expect(composer.confirm().kind).toBe('incomplete')
    composer.chooseCard('ROOT-57#1')
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: {
        type: 'revolt',
        clearing: 0,
        supporterIds: ['ROOT-72#1', 'ROOT-57#1'],
      },
    })
  })
})
