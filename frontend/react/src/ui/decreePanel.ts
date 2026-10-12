import type { GameState } from '#api/client.ts'
import {
  stageableDecreeCardIds,
  type AddToDecreeDraft,
  type DecreeCardOption,
} from '#game/eyrieActionComposerModels.ts'
import { decreeCardSuit } from '#ui/ActionTray.ts'
import {
  DECREE_COLUMN_ORDER,
  decreeCardsOfColumn,
  eyrieDecreeOf,
} from '#ui/decreeColumns.ts'

/** Cards already in a column, of one suit. */
export type DecreePanelSuitCount = {
  suit: string
  count: number
}

/** A hand card laid in a column, not sent yet. */
export type DecreePanelStagedCard = {
  cardId: string
  defId: string
}

export type DecreePanelColumn = {
  column: string
  marks: readonly DecreePanelSuitCount[]
  staged: readonly DecreePanelStagedCard[]
}

/** The Decree while the Eyrie stages cards to add to it. */
export type DecreePanelView = {
  columns: readonly DecreePanelColumn[]
  /** Hand card picked, waiting for its column. */
  pickedCardId: string | null
  stagedCardIds: readonly string[]
  /** Hand cards that may still be laid in a column. */
  stageableCardIds: readonly string[]
  /** Every column each card may be laid in. */
  options: readonly DecreeCardOption[]
  canConfirm: boolean
  canTakeBack: boolean
}

function suitCountsOf(suits: readonly string[]): DecreePanelSuitCount[] {
  const uniqueSuits: readonly string[] = [...new Set(suits)]
  return uniqueSuits.map(
    (suit): DecreePanelSuitCount => ({
      suit,
      count: suits.filter((entry) => entry === suit).length,
    }),
  )
}

/**
 * The four Decree columns with what they hold and what is staged in them.
 * Null when the seat is not the Eyrie.
 */
export function decreePanelView(
  state: GameState,
  actorSeat: number,
  draft: AddToDecreeDraft,
): DecreePanelView | null {
  const decree: object | null = eyrieDecreeOf(state, actorSeat)
  if (decree === null) {
    return null
  }
  const hand =
    state.players.find((player) => player.seat === actorSeat)?.hand ?? []
  const columns: DecreePanelColumn[] = DECREE_COLUMN_ORDER.map(
    (column): DecreePanelColumn => ({
      column,
      marks: suitCountsOf(
        decreeCardsOfColumn(decree, column)
          .map((card) => decreeCardSuit(card.id, state))
          .filter((suit): suit is string => suit !== null),
      ),
      staged: draft.selected
        .filter((entry) => entry.column === column)
        .flatMap((entry): DecreePanelStagedCard[] => {
          const defId: string | undefined = hand.find(
            (card) => card.id === entry.cardId,
          )?.defId
          return defId !== undefined ? [{ cardId: entry.cardId, defId }] : []
        }),
    }),
  )
  return {
    columns,
    pickedCardId: draft.pendingCardId,
    stagedCardIds: draft.selected.map((entry) => entry.cardId),
    stageableCardIds: stageableDecreeCardIds(draft),
    options: draft.options,
    canConfirm: draft.selected.length > 0,
    canTakeBack: draft.selected.length > 0 || draft.pendingCardId !== null,
  }
}

/** Whether a card, picked or dragged, may be laid in a column. */
export function isDecreeColumnOfferedFor(
  view: DecreePanelView,
  option: DecreeCardOption,
): boolean {
  const isStaged: boolean = view.stagedCardIds.includes(option.cardId)
  return (
    (isStaged || view.stageableCardIds.includes(option.cardId)) &&
    view.options.some(
      (offered) =>
        offered.cardId === option.cardId && offered.column === option.column,
    )
  )
}
