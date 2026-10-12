import type { ComposerOutcome } from '#game/resolution/ActionComposer.ts'
import {
  MAXIMUM_DECREE_CARDS_ADDED,
  stageableDecreeCardIds,
  type AddToDecreeDraft,
  type DecreeCardOption,
} from '#game/eyrieActionComposerModels.ts'

const PICK_CARDS_MESSAGE = 'Add to Decree: pick 1 or 2 cards, one bird at most'
const CHOOSE_COLUMN_MESSAGE = 'Choose a Decree column for the card'
const PICK_SECOND_CARD_MESSAGE = 'Pick a second card, or confirm'
const CONFIRM_MESSAGE = 'Confirm the Decree'

function addToDecreeMessage(draft: AddToDecreeDraft): string {
  if (draft.pendingCardId !== null) {
    return CHOOSE_COLUMN_MESSAGE
  }
  if (draft.selected.length === 0) {
    return PICK_CARDS_MESSAGE
  }
  return draft.selected.length < MAXIMUM_DECREE_CARDS_ADDED
    ? PICK_SECOND_CARD_MESSAGE
    : CONFIRM_MESSAGE
}

/** Prompt of an Add to Decree being staged: nothing is sent before Confirm. */
export function addToDecreeOutcome(draft: AddToDecreeDraft): ComposerOutcome {
  return {
    kind: 'incomplete',
    prompt: {
      message: addToDecreeMessage(draft),
      highlightClearings: [],
      enabledCardIds: stageableDecreeCardIds(draft),
      canConfirm: draft.selected.length > 0,
      canCancel: true,
    },
  }
}

/** A hand card is picked, waiting for its column; picking it again lets it go. */
export function withDecreeCardPicked(
  draft: AddToDecreeDraft,
  cardId: string,
): AddToDecreeDraft {
  if (draft.pendingCardId === cardId) {
    return { ...draft, pendingCardId: null }
  }
  return stageableDecreeCardIds(draft).includes(cardId)
    ? { ...draft, pendingCardId: cardId }
    : draft
}

/**
 * A card is laid in a column. A card staged already moves to the new column.
 * Unchanged when the column is not offered for the card, or the card would be
 * a third card or a second bird.
 */
export function withDecreeCardStaged(
  draft: AddToDecreeDraft,
  option: DecreeCardOption,
): AddToDecreeDraft {
  const isOffered: boolean = draft.options.some(
    (offered) =>
      offered.cardId === option.cardId && offered.column === option.column,
  )
  const withoutCard: AddToDecreeDraft = withDecreeCardTakenBack(
    draft,
    option.cardId,
  )
  if (!isOffered || !stageableDecreeCardIds(withoutCard).includes(option.cardId)) {
    return draft
  }
  return {
    ...withoutCard,
    selected: [
      ...withoutCard.selected,
      { cardId: option.cardId, column: option.column },
    ],
    pendingCardId: null,
  }
}

/** A staged card goes back to the hand. */
export function withDecreeCardTakenBack(
  draft: AddToDecreeDraft,
  cardId: string,
): AddToDecreeDraft {
  return {
    ...draft,
    selected: draft.selected.filter((entry) => entry.cardId !== cardId),
  }
}

/** Every staged card goes back to the hand, and the picked one is let go. */
export function withDecreeStagingCleared(
  draft: AddToDecreeDraft,
): AddToDecreeDraft {
  return { ...draft, selected: [], pendingCardId: null }
}
