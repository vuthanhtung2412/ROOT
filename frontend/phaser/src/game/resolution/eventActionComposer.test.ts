import { describe, expect, it } from 'vitest'
import { makeActionSpec } from '#test/factories.ts'
import { ActionComposer } from '#game/resolution/ActionComposer.ts'
import { createEventComposerHooks } from '#game/resolution/eventActionComposer.ts'

describe('eventActionComposer Field Hospitals', () => {
  it('beginFieldHospital with no cards auto-declines', () => {
    const events = createEventComposerHooks()
    expect(events.beginFieldHospital([])).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', decline: true },
    })
  })

  it('beginFieldHospital prompts pay card or Decline', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = events.beginFieldHospital(['ROOT-205#1', 'ROOT-72#1'])
    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') {
      throw new Error('expected incomplete')
    }
    expect(mid.prompt.message).toContain('Field Hospitals')
    expect(mid.prompt.enabledCardIds).toEqual(['ROOT-205#1', 'ROOT-72#1'])
    expect(events.getOverlayKind()).toBe('fieldHospital')
    expect(events.getPromptOptions()).toEqual([
      { label: 'Decline Field Hospitals', value: 'decline' },
    ])
    expect(events.getOptionPresentation()).toBe('buttons')
    expect(composer.chooseCard('ROOT-72#1')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', cardId: 'ROOT-72#1' },
    })
  })

  it('Field Hospitals Decline option submits decline', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    events.beginFieldHospital(['ROOT-205#1'])
    expect(composer.chooseColumn('decline')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', decline: true },
    })
  })

  it('Field Hospitals cancel declines', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    events.beginFieldHospital(['ROOT-205#1'])
    expect(composer.cancel()).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', decline: true },
    })
  })

  it('beginAmbush prompts play or skip', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = events.beginAmbush(['ROOT-200#1'], 'ambush')
    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') {
      throw new Error('expected incomplete')
    }
    expect(mid.prompt.message).toContain('Ambush')
    expect(composer.chooseCard('ROOT-200#1')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', cardId: 'ROOT-200#1' },
    })
  })

  it('beginAmbush with no cards auto-skips', () => {
    const events = createEventComposerHooks()
    expect(events.beginAmbush([], 'foil')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', decline: true },
    })
  })

  it('decline resolveEvent submits immediately (ambush skip)', () => {
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

  it('single cardId resolveEvent submits immediately (ambush)', () => {
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

  it('pieceIds removal uses battle stepper choices', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = events.beginBattleRemoval([
      {
        label: '1 x sawmill',
        value: '0',
        pieceIds: ['b1'],
      },
      {
        label: '1 x wood',
        value: '1',
        pieceIds: ['t1'],
      },
    ])
    expect(mid.kind).toBe('incomplete')
    expect(events.getOptionPresentation()).toBe('stepper')
    expect(composer.chooseColumn('1')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', pieceIds: ['t1'] },
    })
  })

  it('single removal combo auto-submits', () => {
    const events = createEventComposerHooks()
    expect(
      events.beginBattleRemoval([
        {
          label: '2 x warriors',
          value: '0',
          pieceIds: ['w1', 'w2'],
        },
      ]),
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
