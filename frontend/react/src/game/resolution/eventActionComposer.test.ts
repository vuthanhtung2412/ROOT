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

  it('pieceIds removal uses click-to-pick tiles then confirm', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = events.beginBattleRemoval({
      forcedPieceIds: ['w1'],
      hitsToChoose: 1,
      fungibleOnly: false,
      legalCombos: [
        ['w1', 'b1'],
        ['w1', 't1'],
      ],
      tiles: [
        { pieceId: 'b1', kind: 'building', type: 'sawmill' },
        { pieceId: 't1', kind: 'token', type: 'wood' },
      ],
    })
    expect(mid.kind).toBe('incomplete')
    expect(mid.kind === 'incomplete' ? mid.prompt.message : null).toBe(
      'Battle — remove 1 piece',
    )
    expect(events.getOptionPresentation()).toBe('buttons')
    expect(composer.chooseColumn('t1').kind).toBe('incomplete')
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', pieceIds: ['w1', 't1'] },
    })
  })

  it('single removal combo auto-submits', () => {
    const events = createEventComposerHooks()
    expect(
      events.beginBattleRemoval({
        forcedPieceIds: ['w1', 'w2'],
        hitsToChoose: 0,
        fungibleOnly: true,
        legalCombos: [['w1', 'w2']],
        tiles: [],
      }),
    ).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', pieceIds: ['w1', 'w2'] },
    })
  })

  it('fungible warrior-only combos auto-submit without a pick UI', () => {
    const events = createEventComposerHooks()
    expect(
      events.beginBattleRemoval({
        forcedPieceIds: [],
        hitsToChoose: 3,
        fungibleOnly: true,
        legalCombos: [
          ['w1', 'w2', 'w3'],
          ['w1', 'w2', 'w4'],
          ['w1', 'w3', 'w4'],
          ['w2', 'w3', 'w4'],
        ],
        tiles: [
          { pieceId: 'w1', kind: 'warrior' },
          { pieceId: 'w2', kind: 'warrior' },
          { pieceId: 'w3', kind: 'warrior' },
          { pieceId: 'w4', kind: 'warrior' },
        ],
      }),
    ).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', pieceIds: ['w1', 'w2', 'w3'] },
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

  it('chooseCharacter lists Vagabond characters then submits', () => {
    const events = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(events.hooks)

    const mid = composer.begin(
      makeActionSpec({
        type: 'resolveEvent',
        params: { characters: ['thief', 'tinker', 'ranger'] },
      }),
    )

    expect(mid.kind).toBe('incomplete')
    if (mid.kind !== 'incomplete') throw new Error('expected incomplete')
    expect(mid.prompt.message).toBe('Choose Vagabond character')
    expect(mid.prompt.canCancel).toBe(false)
    expect(events.getPromptOptions()).toEqual([
      { label: 'Thief — Steal', value: 'thief' },
      { label: 'Tinker — Day Labor', value: 'tinker' },
      { label: 'Ranger — Hideout', value: 'ranger' },
    ])
    expect(composer.chooseColumn('unknown').kind).not.toBe('ready')
    expect(composer.chooseColumn('ranger')).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', character: 'ranger' },
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

describe('eventActionComposer Vagabond item limit', () => {
  it('picks the over-limit items and submits vbRemoveItems', () => {
    const eventComposer = createEventComposerHooks()
    const composer = new ActionComposer()
    composer.setHooks(eventComposer.hooks)

    const opened = composer.begin(
      makeActionSpec({
        type: 'vbRemoveItems',
        params: {
          vagabondItems: [
            { type: 'sword', exhausted: false },
            { type: 'boot', exhausted: true, damaged: true },
          ],
          itemCount: [1],
        },
      }),
    )
    expect(opened).toMatchObject({
      kind: 'incomplete',
      prompt: {
        message: 'Vagabond — choose 1 item to remove (over item limit) (0/1)',
      },
    })
    expect(eventComposer.getPromptOptions()).toEqual([
      {
        label: 'sword',
        value: '0',
        item: { type: 'sword', exhausted: false, damaged: false, selected: false },
      },
      {
        label: 'boot (exhausted, damaged)',
        value: '1',
        item: { type: 'boot', exhausted: true, damaged: true, selected: false },
      },
    ])
    composer.chooseColumn('1')
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: {
        type: 'vbRemoveItems',
        items: [{ type: 'boot', exhausted: true, damaged: true }],
      },
    })
  })
})

describe('eventActionComposer Ranger Hideout', () => {
  const DAMAGED_ITEMS = [
    { type: 'sword', exhausted: false, damaged: true },
    { type: 'boot', exhausted: true, damaged: true },
    { type: 'hammer', exhausted: false, damaged: true },
    { type: 'tea', exhausted: false, damaged: true },
  ]

  function beginHideout(): ActionComposer {
    const composer = new ActionComposer()
    composer.setHooks(createEventComposerHooks().hooks)
    composer.begin(
      makeActionSpec({
        type: 'hideout',
        params: { vagabondItems: DAMAGED_ITEMS, itemCount: [3] },
      }),
    )
    return composer
  }

  it('picks three damaged items and submits hideout', () => {
    const composer = beginHideout()

    composer.chooseColumn('0')
    composer.chooseColumn('1')
    const lastPick = composer.chooseColumn('3')

    expect(lastPick).toMatchObject({
      kind: 'incomplete',
      prompt: {
        message:
          'Vagabond — choose 3 items to repair (Hideout ends Daylight) — Confirm when ready',
        canConfirm: true,
        canCancel: true,
      },
    })
    expect(composer.confirm()).toEqual({
      kind: 'ready',
      action: {
        type: 'hideout',
        items: [DAMAGED_ITEMS[0], DAMAGED_ITEMS[1], DAMAGED_ITEMS[3]],
      },
    })
  })

  it('can be cancelled, unlike forced item damage', () => {
    const composer = beginHideout()

    expect(composer.cancel()).toEqual({ kind: 'idle' })
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
    expect(
      eventComposer.getPromptOptions().map((option) => option.label),
    ).toEqual(['boot', 'boot (exhausted)', 'torch', 'sword'])
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
      item: { type: 'boot', exhausted: true, damaged: false, selected: true },
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
