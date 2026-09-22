import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import { ActionComposer } from '#game/ActionComposer.ts'
import { createEventComposerHooks } from '#game/eventActionComposer.ts'

describe('eventActionComposer Field Hospitals', () => {
  it('decline resolveEvent submits immediately', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    expect(
      composer.begin(
        makeActionSpec({
          type: 'resolveEvent',
          params: { decline: [true] },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', decline: true },
    })
  })

  it('single cardId resolveEvent submits immediately', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    expect(
      composer.begin(
        makeActionSpec({
          type: 'resolveEvent',
          params: { cardIds: ['ROOT-205#1'] },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', cardId: 'ROOT-205#1' },
    })
  })
})

describe('eventActionComposer battle', () => {
  it('useEffect option emits boolean', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: { useEffect: [false, true] },
      }),
    )
    expect(mid.kind).toBe('incomplete')
    expect(events.getOverlayKind()).toBe('battle')
    expect(composer.chooseColumn('true')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', useEffect: true },
    })
  })

  it('effects order emits seat order', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: { order: [[0, 1], [1, 0]] },
      }),
    )
    expect(composer.chooseColumn('1')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', order: [1, 0] },
    })
  })

  it('pieceIds combo submits whole list', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    expect(
      composer.begin(
        makeActionSpec({
          type: 'resolveEvent',
          params: { pieceIds: ['w1', 'w2'] },
        }),
      ),
    ).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', pieceIds: ['w1', 'w2'] },
    })
  })
})

describe('eventActionComposer setup picks', () => {
  it('chooseKeep highlights corners then submits clearing', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: { clearing: [0, 1, 2, 3] },
      }),
    )
    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') throw new Error('expected incomplete')
    expect(mid.prompt.highlightClearings).toEqual([0, 1, 2, 3])
    expect(composer.chooseClearing(2)).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', clearing: 2 },
    })
  })

  it('chooseLeader lists leaders then submits', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: { leaders: ['builder', 'charismatic'] },
      }),
    )
    expect(mid.kind).toBe('incomplete')
    expect(events.getPromptOptions().map((option) => option.value)).toEqual([
      'builder',
      'charismatic',
    ])
    expect(events.getPromptOptions().map((option) => option.label)).toEqual([
      'Builder · Recruit & Move',
      'Charismatic · Recruit & Battle',
    ])
    expect(composer.chooseColumn('charismatic')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', leader: 'charismatic' },
    })
  })

  it('placeStartingBuilding highlights zone then submits clearing', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: { clearing: [0, 1, 5], building: ['sawmill'] },
      }),
    )
    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') throw new Error('expected incomplete')
    expect(mid.prompt.message).toBe('Place sawmill')
    expect(mid.prompt.highlightClearings).toEqual([0, 1, 5])
    expect(composer.chooseClearing(5)).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', clearing: 5 },
    })
  })
})
