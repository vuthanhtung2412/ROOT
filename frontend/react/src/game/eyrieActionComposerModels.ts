export type DecreeCardOption = { cardId: string; column: string }
export type MarchMove = { from: number; to: number; count: number }
export type BattleTarget = { clearing: number; defender: number }

export type EyrieDraft =
  | { type: 'idle' }
  | {
      type: 'addToDecree'
      options: DecreeCardOption[]
      birdCardIds: Set<string>
      selected: DecreeCardOption[]
      pendingCardId: string | null
    }
  | { type: 'newRoost'; clearings: number[] }
  | {
      type: 'decree'
      column: string
      cardId: string
      clearings: number[]
      targets: BattleTarget[]
      moves: MarchMove[]
      from: number | null
      to: number | null
      picking:
        | 'clearing'
        | 'defender'
        | 'moveFrom'
        | 'moveTo'
        | 'moveCount'
        | 'done'
    }

export function isDecreeCardOption(
  value: unknown,
): value is DecreeCardOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const cardId = Reflect.get(value, 'cardId')
  const column = Reflect.get(value, 'column')
  return typeof cardId === 'string' && typeof column === 'string'
}

export type AddToDecreeDraft = Extract<EyrieDraft, { type: 'addToDecree' }>

/** Cards added to the Decree in one Birdsong, at most. Rule: Eyrie 7.4.2. */
export const MAXIMUM_DECREE_CARDS_ADDED = 2

/**
 * Hand cards that may still be staged: a place is left and the card would not
 * be a second bird. Rule: Eyrie 7.4.2.
 */
export function stageableDecreeCardIds(draft: AddToDecreeDraft): string[] {
  if (draft.selected.length >= MAXIMUM_DECREE_CARDS_ADDED) {
    return []
  }
  const stagedCardIds: ReadonlySet<string> = new Set(
    draft.selected.map((entry) => entry.cardId),
  )
  const hasStagedBird: boolean = draft.selected.some((entry) =>
    draft.birdCardIds.has(entry.cardId),
  )
  return uniqueCardIds(draft.options).filter(
    (cardId) =>
      !stagedCardIds.has(cardId) &&
      !(hasStagedBird && draft.birdCardIds.has(cardId)),
  )
}

export function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)]
}

export function uniqueCardIds(options: DecreeCardOption[]): string[] {
  return [...new Set(options.map((option) => option.cardId))]
}
