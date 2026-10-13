import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionSpec } from '#api/client.ts'
import {
  craftedItemTypeOfCurrentPlayer,
  warriorOwnerSeat,
} from '#game/cardActionLabels.ts'
import {
  ActionComposer,
  type ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'
import { AutoPromptController } from '#game/resolution/autoPromptController.ts'
import { createEventComposerHooks } from '#game/resolution/eventActionComposer.ts'
import { createOptionComposerHooks } from '#game/resolution/optionActionComposer.ts'
import type { GameSessionSnapshot } from '#game/GameSession.ts'
import { makeActionSpec, makeGameState } from '#test/factories.ts'
import { formatActionLabel } from '#ui/ActionTray.ts'
import type { CardGalleryFace } from '#ui/cardGalleryTypes.ts'
import type { TurnBannerOption } from '#ui/TurnBanner.ts'

const MOUSE_CARD_ID = 'ROOT-218#1'
const SWORD_CARD_ID = 'ROOT-224#1'
const CAT_WARRIOR_ID = 'w-11'
const BIRD_WARRIOR_ID = 'w-12'
const FACTIONS: readonly string[] = ['marquise', 'alliance', 'eyrie']
const WARRIOR_OWNER_SEATS: Readonly<Record<string, number>> = {
  [CAT_WARRIOR_ID]: 0,
  [BIRD_WARRIOR_ID]: 2,
}
/** Crafted Items box of the actor: a boot, a second boot, a tea. */
const CRAFTED_ITEM_TYPES: readonly string[] = ['boot', 'boot', 'tea']
const BOOT_ITEM_INDEX = 0
const TEA_ITEM_INDEX = 2

type ComposerUnderTest = {
  composer: ActionComposer
  promptOptions: () => TurnBannerOption[]
  /** Cards of the pile the player is asked to pick from. */
  shownPileCardIds: () => string[]
}

function composerUnderTest(pendingType: string | null = null): ComposerUnderTest {
  const option = createOptionComposerHooks({
    pendingType: (): string | null => pendingType,
    factionNameForSeat: (seat: number): string | null => FACTIONS[seat] ?? null,
    warriorOwnerSeat: (pieceId: string): number | null =>
      WARRIOR_OWNER_SEATS[pieceId] ?? null,
    craftedItemType: (itemIndex: number): string | null =>
      CRAFTED_ITEM_TYPES[itemIndex] ?? null,
  })
  const composer = new ActionComposer()
  composer.setHooks(option.hooks)
  return {
    composer,
    promptOptions: option.getPromptOptions,
    shownPileCardIds: (): string[] =>
      (option.getCardPilePick()?.cards ?? []).map(
        (pileCard: CardGalleryFace): string => pileCard.id,
      ),
  }
}

function expectIncomplete(
  outcome: ComposerOutcome,
): Extract<ComposerOutcome, { kind: 'incomplete' }> {
  if (outcome.kind !== 'incomplete') {
    throw new Error(`expected incomplete, got ${outcome.kind}`)
  }
  return outcome
}

// The auto-prompt controller reads a QA flag on `window`; no browser here.
beforeEach((): void => {
  vi.stubGlobal('window', {})
})

afterEach((): void => {
  vi.unstubAllGlobals()
})

describe('Propaganda Bureau flow', () => {
  const spec: ActionSpec = makeActionSpec({
    type: 'propagandaBureau',
    params: {
      options: [
        { cardId: MOUSE_CARD_ID, clearing: 6, pieceId: CAT_WARRIOR_ID },
        { cardId: SWORD_CARD_ID, clearing: 6, pieceId: CAT_WARRIOR_ID },
        { cardId: MOUSE_CARD_ID, clearing: 6, pieceId: BIRD_WARRIOR_ID },
        { cardId: MOUSE_CARD_ID, clearing: 1, pieceId: 'w-13' },
      ],
    },
  })

  it('asks clearing, then the enemy by faction name, then the card to spend', () => {
    const { composer, promptOptions } = composerUnderTest()

    const begun = expectIncomplete(composer.begin(spec))
    expect(begun.prompt.highlightClearings).toEqual([6, 1])
    expect(begun.prompt.canCancel).toBe(true)

    expectIncomplete(composer.chooseClearing(6))
    expect(promptOptions()).toEqual([
      { label: 'marquise', value: 'choice:0' },
      { label: 'eyrie', value: 'choice:1' },
    ])

    const afterEnemy = expectIncomplete(composer.chooseColumn('choice:0'))
    expect(afterEnemy.prompt.enabledCardIds).toEqual([
      MOUSE_CARD_ID,
      SWORD_CARD_ID,
    ])

    expect(composer.chooseCard(SWORD_CARD_ID)).toEqual({
      kind: 'ready',
      action: {
        type: 'propagandaBureau',
        clearing: 6,
        pieceId: CAT_WARRIOR_ID,
        cardId: SWORD_CARD_ID,
      },
    })
  })

  it('asks every step even when it has a single possible value', () => {
    const { composer, promptOptions } = composerUnderTest()
    const singleOptionSpec: ActionSpec = makeActionSpec({
      type: 'propagandaBureau',
      params: {
        options: [
          { cardId: MOUSE_CARD_ID, clearing: 6, pieceId: CAT_WARRIOR_ID },
        ],
      },
    })

    expect(
      expectIncomplete(composer.begin(singleOptionSpec)).prompt
        .highlightClearings,
    ).toEqual([6])
    expectIncomplete(composer.chooseClearing(6))
    expect(promptOptions()).toEqual([{ label: 'marquise', value: 'choice:0' }])
    expect(
      expectIncomplete(composer.chooseColumn('choice:0')).prompt.enabledCardIds,
    ).toEqual([MOUSE_CARD_ID])
  })

  it('has a tray label', () => {
    expect(formatActionLabel(spec)).toBe('propaganda bureau')
  })
})

describe('Charm Offensive flow', () => {
  const spec: ActionSpec = makeActionSpec({
    type: 'charmOffensive',
    params: { options: [{ target: 0 }] },
  })

  it('asks who scores the point, even with a single other player', () => {
    const { composer, promptOptions } = composerUnderTest()

    expectIncomplete(composer.begin(spec))
    expect(promptOptions()).toEqual([{ label: 'marquise', value: 'choice:0' }])
    expect(composer.chooseColumn('choice:0')).toEqual({
      kind: 'ready',
      action: { type: 'charmOffensive', target: 0 },
    })
  })

  it('has a tray label', () => {
    expect(formatActionLabel(spec)).toBe('charm offensive')
  })
})

describe('Eyrie Émigré flow', () => {
  const spec: ActionSpec = makeActionSpec({
    type: 'eyrieEmigre',
    params: {
      options: [
        { from: 9, to: 1, count: 1, defender: 0 },
        { from: 9, to: 1, count: 2, defender: 0 },
        { from: 9, to: 1, count: 1, defender: 2 },
        { from: 9, to: 1, count: 2, defender: 2 },
        { from: 9, to: 0, count: 1 },
        { from: 9, to: 0, count: 2 },
      ],
    },
  })

  it('cannot be cancelled: the move is forced', () => {
    const { composer } = composerUnderTest()

    const begun = expectIncomplete(composer.begin(spec))
    expect(begun.prompt.canCancel).toBe(false)
    expect(begun.prompt.highlightClearings).toEqual([9])
    expect(composer.cancel().kind).toBe('incomplete')
  })

  it('destination with enemies: origin, destination, count, then the defender', () => {
    const { composer, promptOptions } = composerUnderTest()
    composer.begin(spec)

    const afterOrigin = expectIncomplete(composer.chooseClearing(9))
    expect(afterOrigin.prompt.highlightClearings).toEqual([1, 0])
    expectIncomplete(composer.chooseClearing(1))
    expectIncomplete(composer.chooseColumn('2'))
    expect(promptOptions()).toEqual([
      { label: 'marquise', value: 'choice:0' },
      { label: 'eyrie', value: 'choice:1' },
    ])

    expect(composer.chooseColumn('choice:1')).toEqual({
      kind: 'ready',
      action: { type: 'eyrieEmigre', from: 9, to: 1, count: 2, defender: 2 },
    })
  })

  it('destination with no enemy: no defender is asked', () => {
    const { composer } = composerUnderTest()
    composer.begin(spec)
    composer.chooseClearing(9)
    composer.chooseClearing(0)

    expect(composer.chooseColumn('1')).toEqual({
      kind: 'ready',
      action: { type: 'eyrieEmigre', from: 9, to: 0, count: 1 },
    })
  })

  it('opens by itself when it is the forced action at the end of Birdsong', () => {
    const { composer } = composerUnderTest()
    const applied: ComposerOutcome[] = []
    const controller = new AutoPromptController({
      applyComposerOutcome: (outcome: ComposerOutcome): void => {
        applied.push(outcome)
      },
      composer,
      eventComposer: createEventComposerHooks(),
      submitEndPhase: () => undefined,
      isBattleResultFlashActive: () => false,
      isBoardReady: () => true,
    })
    const snapshot: GameSessionSnapshot = {
      state: makeGameState({ phase: 'birdsong' }),
      legalActions: [spec],
      historyLength: 0,
      log: [],
      error: null,
      loading: false,
    }

    controller.runAfterHudPaint(snapshot, 0, true)
    controller.runAfterHudPaint(snapshot, 0, true)

    expect(applied).toHaveLength(1)
    expect(expectIncomplete(applied[0]!).prompt.message).toBe(
      'Eyrie Émigré — you must move: pick origin',
    )
  })
})

describe('False Orders flow', () => {
  const spec: ActionSpec = makeActionSpec({
    type: 'falseOrders',
    params: {
      options: [
        { target: 0, from: 1, to: 4 },
        { target: 0, from: 1, to: 5 },
        { target: 0, from: 6, to: 7 },
        { target: 2, from: 9, to: 0 },
      ],
    },
  })

  it('asks the enemy, then only their clearings, then where they can go', () => {
    const { composer, promptOptions } = composerUnderTest()

    expectIncomplete(composer.begin(spec))
    expect(promptOptions()).toEqual([
      { label: 'marquise', value: 'choice:0' },
      { label: 'eyrie', value: 'choice:1' },
    ])

    const afterEnemy = expectIncomplete(composer.chooseColumn('choice:0'))
    expect(afterEnemy.prompt.highlightClearings).toEqual([1, 6])
    const afterOrigin = expectIncomplete(composer.chooseClearing(1))
    expect(afterOrigin.prompt.highlightClearings).toEqual([4, 5])

    expect(composer.chooseClearing(5)).toEqual({
      kind: 'ready',
      action: { type: 'falseOrders', target: 0, from: 1, to: 5 },
    })
  })

  it('has a tray label', () => {
    expect(formatActionLabel(spec)).toBe('false orders')
  })
})

describe('Informants flow', () => {
  const FOX_AMBUSH_ID = 'ROOT-202#1'
  const BIRD_AMBUSH_ID = 'ROOT-200#1'
  const spec: ActionSpec = makeActionSpec({
    type: 'informantsTakeAmbush',
    params: {
      cardIds: [FOX_AMBUSH_ID, BIRD_AMBUSH_ID],
      options: [{ cardId: FOX_AMBUSH_ID }, { cardId: BIRD_AMBUSH_ID }],
    },
  })

  it('shows the ambush cards of the Discarded pile and takes the picked one', () => {
    const { composer, shownPileCardIds } = composerUnderTest()

    const begun = expectIncomplete(composer.begin(spec))
    expect(begun.prompt.canCancel).toBe(true)
    expect(shownPileCardIds()).toEqual([FOX_AMBUSH_ID, BIRD_AMBUSH_ID])

    expect(composer.chooseCard(BIRD_AMBUSH_ID)).toEqual({
      kind: 'ready',
      action: { type: 'informantsTakeAmbush', cardId: BIRD_AMBUSH_ID },
    })
  })

  it('has a tray label', () => {
    expect(formatActionLabel(spec)).toBe('informants')
  })
})

describe('League of Adventurous Mice flows', () => {
  const moveSpec: ActionSpec = makeActionSpec({
    type: 'leagueMove',
    params: {
      options: [BOOT_ITEM_INDEX, TEA_ITEM_INDEX].flatMap((itemIndex: number) => [
        { itemIndex, from: 1, to: 4, count: 1 },
        { itemIndex, from: 1, to: 4, count: 2 },
        { itemIndex, from: 1, to: 5, count: 1 },
        { itemIndex, from: 9, to: 0, count: 1 },
      ]),
    },
  })
  const battleSpec: ActionSpec = makeActionSpec({
    type: 'leagueBattle',
    params: {
      options: [
        { itemIndex: TEA_ITEM_INDEX, clearing: 1, defender: 0 },
        { itemIndex: TEA_ITEM_INDEX, clearing: 1, defender: 2 },
      ],
    },
  })

  it('move: item by name, origin, destination, then the warrior count', () => {
    const { composer, promptOptions } = composerUnderTest()

    expectIncomplete(composer.begin(moveSpec))
    expect(promptOptions()).toEqual([
      { label: 'Boot', value: 'choice:0' },
      { label: 'Tea', value: 'choice:1' },
    ])

    const afterItem = expectIncomplete(composer.chooseColumn('choice:1'))
    expect(afterItem.prompt.highlightClearings).toEqual([1, 9])
    const afterOrigin = expectIncomplete(composer.chooseClearing(1))
    expect(afterOrigin.prompt.highlightClearings).toEqual([4, 5])
    expectIncomplete(composer.chooseClearing(4))
    expect(promptOptions()).toEqual([
      { label: '1 warrior', value: '1' },
      { label: '2 warriors', value: '2' },
    ])

    expect(composer.chooseColumn('2')).toEqual({
      kind: 'ready',
      action: {
        type: 'leagueMove',
        itemIndex: TEA_ITEM_INDEX,
        from: 1,
        to: 4,
        count: 2,
      },
    })
  })

  it('battle: item, clearing, then the defender by faction name', () => {
    const { composer, promptOptions } = composerUnderTest()

    expectIncomplete(composer.begin(battleSpec))
    expect(promptOptions()).toEqual([{ label: 'Tea', value: 'choice:0' }])
    expectIncomplete(composer.chooseColumn('choice:0'))
    expectIncomplete(composer.chooseClearing(1))
    expect(promptOptions()).toEqual([
      { label: 'marquise', value: 'choice:0' },
      { label: 'eyrie', value: 'choice:1' },
    ])

    expect(composer.chooseColumn('choice:1')).toEqual({
      kind: 'ready',
      action: {
        type: 'leagueBattle',
        itemIndex: TEA_ITEM_INDEX,
        clearing: 1,
        defender: 2,
      },
    })
  })

  it('has tray labels that tell move from battle', () => {
    expect(formatActionLabel(moveSpec)).toBe('league: move')
    expect(formatActionLabel(battleSpec)).toBe('league: battle')
  })
})

describe('craftedItemTypeOfCurrentPlayer', () => {
  it('reads the Crafted Items box of the player whose turn it is', () => {
    const base = makeGameState({ currentSeat: 1 })
    const state = {
      ...base,
      players: base.players.map((seated) =>
        seated.seat === 1
          ? { ...seated, craftedItems: [{ type: 'sword', exhausted: false }, 'tea'] }
          : { ...seated, craftedItems: ['coin'] },
      ),
    }

    expect(craftedItemTypeOfCurrentPlayer(state, 0)).toBe('sword')
    expect(craftedItemTypeOfCurrentPlayer(state, 1)).toBe('tea')
    expect(craftedItemTypeOfCurrentPlayer(state, 2)).toBeNull()
  })
})

describe('Swap Meet flow', () => {
  const SWAP_MEET_GIVE_PENDING_TYPE = 'swapMeetGive'
  const spec: ActionSpec = makeActionSpec({
    type: 'swapMeet',
    params: { options: [{ target: 0 }, { target: 2 }] },
  })
  const giveSpec: ActionSpec = makeActionSpec({
    type: 'resolveEvent',
    params: { cardIds: [MOUSE_CARD_ID, SWORD_CARD_ID] },
  })

  it('asks which player to take a random card from', () => {
    const { composer, promptOptions } = composerUnderTest()

    expectIncomplete(composer.begin(spec))
    expect(promptOptions()).toEqual([
      { label: 'marquise', value: 'choice:0' },
      { label: 'eyrie', value: 'choice:1' },
    ])
    expect(composer.chooseColumn('choice:1')).toEqual({
      kind: 'ready',
      action: { type: 'swapMeet', target: 2 },
    })
  })

  it('then asks for the card to give: any hand card, and it cannot be cancelled', () => {
    const { composer } = composerUnderTest(SWAP_MEET_GIVE_PENDING_TYPE)

    const begun = expectIncomplete(composer.begin(giveSpec))
    expect(begun.prompt.message).toBe('Swap Meet — pick a card to give')
    expect(begun.prompt.enabledCardIds).toEqual([MOUSE_CARD_ID, SWORD_CARD_ID])
    expect(begun.prompt.canCancel).toBe(false)
    expect(composer.cancel().kind).toBe('incomplete')

    expect(composer.chooseCard(SWORD_CARD_ID)).toEqual({
      kind: 'ready',
      action: { type: 'resolveEvent', cardId: SWORD_CARD_ID },
    })
  })

  it('asks even when a single card can be given', () => {
    const { composer } = composerUnderTest(SWAP_MEET_GIVE_PENDING_TYPE)
    const singleCardSpec: ActionSpec = makeActionSpec({
      type: 'resolveEvent',
      params: { cardIds: [MOUSE_CARD_ID] },
    })

    expect(composer.begin(singleCardSpec).kind).toBe('incomplete')
  })

  it('opens the give prompt by itself, with no tray click', () => {
    const { composer } = composerUnderTest(SWAP_MEET_GIVE_PENDING_TYPE)
    const applied: ComposerOutcome[] = []
    const controller = new AutoPromptController({
      applyComposerOutcome: (outcome: ComposerOutcome): void => {
        applied.push(outcome)
      },
      composer,
      eventComposer: createEventComposerHooks(),
      submitEndPhase: () => undefined,
      isBattleResultFlashActive: () => false,
      isBoardReady: () => true,
    })
    const snapshot: GameSessionSnapshot = {
      state: makeGameState({
        phase: 'birdsong',
        pending: [{ type: SWAP_MEET_GIVE_PENDING_TYPE, seat: 0, target: 1 }],
      }),
      legalActions: [giveSpec],
      historyLength: 0,
      log: [],
      error: null,
      loading: false,
    }

    controller.runAfterHudPaint(snapshot, 0, true)
    controller.runAfterHudPaint(snapshot, 0, true)

    expect(applied).toHaveLength(1)
    expect(expectIncomplete(applied[0]!).prompt.enabledCardIds).toEqual([
      MOUSE_CARD_ID,
      SWORD_CARD_ID,
    ])
  })

  it('has a tray label', () => {
    expect(formatActionLabel(spec)).toBe('swap meet')
  })
})

describe('Saboteurs flow', () => {
  const BOAT_BUILDERS_ID = 'ROOT-57#1'
  const TUNNELS_ID = 'ROOT-108#1'
  const COFFIN_MAKERS_ID = 'ROOT-62#1'
  const spec: ActionSpec = makeActionSpec({
    type: 'saboteurs',
    params: {
      options: [
        { target: 0, cardId: BOAT_BUILDERS_ID },
        { target: 0, cardId: TUNNELS_ID },
        { target: 2, cardId: COFFIN_MAKERS_ID },
      ],
    },
  })

  it('asks the enemy, then shows only the crafted cards of that enemy', () => {
    const { composer, promptOptions, shownPileCardIds } = composerUnderTest()

    expectIncomplete(composer.begin(spec))
    expect(promptOptions()).toEqual([
      { label: 'marquise', value: 'choice:0' },
      { label: 'eyrie', value: 'choice:1' },
    ])

    expectIncomplete(composer.chooseColumn('choice:0'))
    expect(shownPileCardIds()).toEqual([BOAT_BUILDERS_ID, TUNNELS_ID])

    expect(composer.chooseCard(TUNNELS_ID)).toEqual({
      kind: 'ready',
      action: { type: 'saboteurs', target: 0, cardId: TUNNELS_ID },
    })
  })

  it('has a tray label', () => {
    expect(formatActionLabel(spec)).toBe('saboteurs')
  })
})

describe('warriorOwnerSeat', () => {
  it('finds the owner of a warrior on the map, and only of a warrior', () => {
    const clearings = makeGameState().clearings.map(
      (clearing, index: number) =>
        index === 6
          ? {
              pieces: [
                { id: CAT_WARRIOR_ID, kind: 'warrior', owner: 0 },
                { id: 'b-1', kind: 'building', owner: 2, type: 'roost' },
              ],
            }
          : clearing,
    )

    expect(warriorOwnerSeat(clearings, CAT_WARRIOR_ID)).toBe(0)
    expect(warriorOwnerSeat(clearings, 'b-1')).toBeNull()
    expect(warriorOwnerSeat(clearings, 'missing')).toBeNull()
  })
})
