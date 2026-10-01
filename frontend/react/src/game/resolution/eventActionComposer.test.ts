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
    expect(mid.prompt.message).toContain('pay matching suit')
    expect(mid.prompt.enabledCardIds).toEqual(['ROOT-205#1', 'ROOT-72#1'])
    expect(mid.prompt.canCancel).toBe(false)
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

  it('Field Hospitals enables bird card spend', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = events.beginFieldHospital(['ROOT-200#1', 'ROOT-205#1'])
    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') {
      throw new Error('expected incomplete')
    }
    expect(mid.prompt.enabledCardIds).toEqual(['ROOT-200#1', 'ROOT-205#1'])
    expect(composer.chooseCard('ROOT-205#1')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', cardId: 'ROOT-205#1' },
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

  it('Field Hospitals cancel keeps prompt (no auto-decline)', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    events.beginFieldHospital(['ROOT-205#1'])
    const afterCancel = composer.cancel()
    expect(afterCancel.kind).toBe('incomplete')
    if (afterCancel.kind !== 'incomplete') {
      throw new Error('expected incomplete')
    }
    expect(afterCancel.prompt.canCancel).toBe(false)
    expect(events.getDraft().type).toBe('pickFieldHospital')
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
    expect(mid.prompt.canCancel).toBe(false)
    expect(composer.chooseCard('ROOT-200#1')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', cardId: 'ROOT-200#1' },
    })
  })

  it('beginAmbush cancel keeps prompt (no auto-skip)', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    events.beginAmbush(['ROOT-200#1'], 'ambush')
    const afterCancel = composer.cancel()
    expect(afterCancel.kind).toBe('incomplete')
    expect(events.getDraft().type).toBe('pickAmbush')
  })

  it('beginAmbush with no cards still prompts Skip', () => {
    const events = createEventComposerHooks()
    const mid = events.beginAmbush([], 'foil')
    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') {
      throw new Error('expected incomplete')
    }
    expect(mid.prompt.canCancel).toBe(false)
    expect(mid.prompt.enabledCardIds).toEqual([])
    expect(events.getPromptOptions()).toEqual([
      { label: 'Skip foil', value: 'decline' },
    ])
  })

  it('decline resolveEvent via begin still auto-submits (tray path)', () => {
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

  it('chooseForest highlights forests then submits forest index', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const forests = [0, 1, 2, 3, 4]
    const mid = composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: { forests },
      }),
    )
    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') throw new Error('expected incomplete')
    expect(mid.prompt.message).toBe('Choose starting forest')
    expect(mid.prompt.highlightForests).toEqual(forests)
    expect(composer.chooseForest(3)).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', forest: 3 },
    })
  })
})

describe('eventActionComposer Vagabond item damage', () => {
  const VAGABOND_SEAT = 3
  const OFFERED_ITEMS = [
    { type: 'boot', exhausted: false },
    { type: 'boot', exhausted: true },
    { type: 'torch', exhausted: false },
    { type: 'sword', exhausted: false },
  ]

  it('toggles items and confirms once the exact count is chosen', () => {
    const eventComposer = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(eventComposer.hooks)

    const opened = composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        actor: VAGABOND_SEAT,
        params: { vagabondItems: OFFERED_ITEMS, itemCount: [2] },
      }),
    )
    expect(opened).toMatchObject({
      kind: 'incomplete',
      prompt: {
        message: 'Vagabond — choose 2 items to damage (0/2)',
        canConfirm: false,
        canCancel: false,
      },
    })
    expect(eventComposer.getPromptOptions()).toEqual([
      { label: 'boot', value: '0' },
      { label: 'boot (exhausted)', value: '1' },
      { label: 'torch', value: '2' },
      { label: 'sword', value: '3' },
    ])
    expect(composer.confirm().kind).toBe('incomplete')

    composer.chooseColumn('0')
    composer.chooseColumn('3')
    // Third pick beyond the count is ignored.
    composer.chooseColumn('2')
    // Deselect boot, then take the exhausted boot instead.
    composer.chooseColumn('0')
    const afterPicks = composer.chooseColumn('1')
    expect(afterPicks).toMatchObject({
      kind: 'incomplete',
      prompt: {
        message: 'Vagabond — choose 2 items to damage — Confirm when ready',
        canConfirm: true,
      },
    })
    expect(eventComposer.getPromptOptions()[1]).toEqual({
      label: '✓ boot (exhausted)',
      value: '1',
    })

    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: {
        type: 'resolveEvent',
        items: [
          { type: 'sword', exhausted: false },
          { type: 'boot', exhausted: true },
        ],
      },
    })
  })
})
