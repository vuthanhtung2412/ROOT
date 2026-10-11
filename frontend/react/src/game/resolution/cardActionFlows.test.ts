import { describe, expect, it } from 'vitest'
import type { ActionSpec } from '#api/client.ts'
import { warriorOwnerSeat } from '#game/cardActionLabels.ts'
import {
  ActionComposer,
  type ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'
import { createOptionComposerHooks } from '#game/resolution/optionActionComposer.ts'
import { makeActionSpec, makeGameState } from '#test/factories.ts'
import { formatActionLabel } from '#ui/ActionTray.ts'
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

type ComposerUnderTest = {
  composer: ActionComposer
  promptOptions: () => TurnBannerOption[]
}

function composerUnderTest(): ComposerUnderTest {
  const option = createOptionComposerHooks({
    factionNameForSeat: (seat: number): string | null => FACTIONS[seat] ?? null,
    warriorOwnerSeat: (pieceId: string): number | null =>
      WARRIOR_OWNER_SEATS[pieceId] ?? null,
  })
  const composer = new ActionComposer()
  composer.setHooks(option.hooks)
  return { composer, promptOptions: option.getPromptOptions }
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
