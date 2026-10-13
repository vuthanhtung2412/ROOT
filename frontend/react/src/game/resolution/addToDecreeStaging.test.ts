import { describe, expect, it } from 'vitest'
import type { AddToDecreeDraft } from '#game/eyrieActionComposerModels.ts'
import {
  addToDecreeOutcome,
  withDecreeCardPicked,
  withDecreeCardStaged,
  withDecreeCardTakenBack,
  withDecreeStagingCleared,
} from '#game/resolution/addToDecreeStaging.ts'

const FOX_CARD_ID = 'fox'
const MOUSE_CARD_ID = 'mouse'
const RABBIT_CARD_ID = 'rabbit'
const FIRST_BIRD_CARD_ID = 'bird-1'
const SECOND_BIRD_CARD_ID = 'bird-2'
const DECREE_COLUMNS: readonly string[] = ['recruit', 'move', 'battle', 'build']

/** Five hand cards, two of them birds, each offered for every column. */
function makeAddToDecreeDraft(
  overrides: Partial<AddToDecreeDraft> = {},
): AddToDecreeDraft {
  const cardIds: readonly string[] = [
    FOX_CARD_ID,
    MOUSE_CARD_ID,
    RABBIT_CARD_ID,
    FIRST_BIRD_CARD_ID,
    SECOND_BIRD_CARD_ID,
  ]
  return {
    type: 'addToDecree',
    options: cardIds.flatMap((cardId) =>
      DECREE_COLUMNS.map((column) => ({ cardId, column })),
    ),
    birdCardIds: new Set([FIRST_BIRD_CARD_ID, SECOND_BIRD_CARD_ID]),
    selected: [],
    pendingCardId: null,
    ...overrides,
  }
}

function enabledCardIdsOf(draft: AddToDecreeDraft): string[] | null {
  const outcome = addToDecreeOutcome(draft)
  return outcome.kind === 'incomplete' ? outcome.prompt.enabledCardIds : null
}

describe('addToDecreeOutcome', () => {
  it('leaves confirm and take back to the Decree panel', () => {
    const outcome = addToDecreeOutcome(
      makeAddToDecreeDraft({
        selected: [{ cardId: FOX_CARD_ID, column: 'move' }],
      }),
    )

    expect(outcome.kind === 'incomplete' && outcome.prompt.canConfirm).toBe(false)
    expect(outcome.kind === 'incomplete' && outcome.prompt.canCancel).toBe(false)
  })

  it('enables every hand card while nothing is staged', () => {
    expect(enabledCardIdsOf(makeAddToDecreeDraft())).toEqual([
      FOX_CARD_ID,
      MOUSE_CARD_ID,
      RABBIT_CARD_ID,
      FIRST_BIRD_CARD_ID,
      SECOND_BIRD_CARD_ID,
    ])
  })

  it('disables the other bird cards once a bird is staged', () => {
    const draft = makeAddToDecreeDraft({
      selected: [{ cardId: FIRST_BIRD_CARD_ID, column: 'move' }],
    })

    expect(enabledCardIdsOf(draft)).toEqual([
      FOX_CARD_ID,
      MOUSE_CARD_ID,
      RABBIT_CARD_ID,
    ])
  })

  it('disables the whole hand once two cards are staged', () => {
    const draft = makeAddToDecreeDraft({
      selected: [
        { cardId: FOX_CARD_ID, column: 'move' },
        { cardId: MOUSE_CARD_ID, column: 'build' },
      ],
    })

    expect(enabledCardIdsOf(draft)).toEqual([])
  })
})

describe('withDecreeCardPicked', () => {
  it('picks a card, and lets it go when picked again', () => {
    const picked = withDecreeCardPicked(makeAddToDecreeDraft(), FOX_CARD_ID)

    expect(picked.pendingCardId).toBe(FOX_CARD_ID)
    expect(withDecreeCardPicked(picked, FOX_CARD_ID).pendingCardId).toBeNull()
  })

  it('does not pick a second bird', () => {
    const draft = makeAddToDecreeDraft({
      selected: [{ cardId: FIRST_BIRD_CARD_ID, column: 'move' }],
    })

    expect(
      withDecreeCardPicked(draft, SECOND_BIRD_CARD_ID).pendingCardId,
    ).toBeNull()
  })
})

describe('withDecreeCardStaged', () => {
  it('lays the card and lets the pick go', () => {
    const picked = makeAddToDecreeDraft({ pendingCardId: FOX_CARD_ID })

    const staged = withDecreeCardStaged(picked, {
      cardId: FOX_CARD_ID,
      column: 'recruit',
    })

    expect(staged.selected).toEqual([{ cardId: FOX_CARD_ID, column: 'recruit' }])
    expect(staged.pendingCardId).toBeNull()
  })

  it('moves a staged card to another column', () => {
    const draft = makeAddToDecreeDraft({
      selected: [
        { cardId: FOX_CARD_ID, column: 'recruit' },
        { cardId: MOUSE_CARD_ID, column: 'build' },
      ],
    })

    const moved = withDecreeCardStaged(draft, {
      cardId: FOX_CARD_ID,
      column: 'battle',
    })

    expect(moved.selected).toEqual([
      { cardId: MOUSE_CARD_ID, column: 'build' },
      { cardId: FOX_CARD_ID, column: 'battle' },
    ])
  })

  it('refuses a third card', () => {
    const draft = makeAddToDecreeDraft({
      selected: [
        { cardId: FOX_CARD_ID, column: 'recruit' },
        { cardId: MOUSE_CARD_ID, column: 'build' },
      ],
    })

    expect(
      withDecreeCardStaged(draft, { cardId: RABBIT_CARD_ID, column: 'move' }),
    ).toBe(draft)
  })

  it('refuses a second bird', () => {
    const draft = makeAddToDecreeDraft({
      selected: [{ cardId: FIRST_BIRD_CARD_ID, column: 'recruit' }],
    })

    expect(
      withDecreeCardStaged(draft, {
        cardId: SECOND_BIRD_CARD_ID,
        column: 'move',
      }),
    ).toBe(draft)
  })

  it('refuses a column the card is not offered for', () => {
    const draft = makeAddToDecreeDraft({
      options: [{ cardId: FOX_CARD_ID, column: 'recruit' }],
    })

    expect(
      withDecreeCardStaged(draft, { cardId: FOX_CARD_ID, column: 'move' }),
    ).toBe(draft)
  })
})

describe('taking staged cards back', () => {
  it('takes one staged card back', () => {
    const draft = makeAddToDecreeDraft({
      selected: [
        { cardId: FOX_CARD_ID, column: 'recruit' },
        { cardId: MOUSE_CARD_ID, column: 'build' },
      ],
    })

    expect(withDecreeCardTakenBack(draft, FOX_CARD_ID).selected).toEqual([
      { cardId: MOUSE_CARD_ID, column: 'build' },
    ])
  })

  it('clears every staged card and the pick', () => {
    const draft = makeAddToDecreeDraft({
      selected: [{ cardId: FOX_CARD_ID, column: 'recruit' }],
      pendingCardId: MOUSE_CARD_ID,
    })

    const cleared = withDecreeStagingCleared(draft)

    expect(cleared.selected).toEqual([])
    expect(cleared.pendingCardId).toBeNull()
  })
})
