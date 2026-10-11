import { describe, expect, it } from 'vitest'
import type { ActionSpec } from '#api/client.ts'
import {
  craftedItemTypeOfCurrentPlayer,
  warriorOwnerSeat,
} from '#game/cardActionLabels.ts'
import {
  ActionComposer,
  type ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'
import { createOptionComposerHooks } from '#game/resolution/optionActionComposer.ts'
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

function composerUnderTest(): ComposerUnderTest {
  const option = createOptionComposerHooks({
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
