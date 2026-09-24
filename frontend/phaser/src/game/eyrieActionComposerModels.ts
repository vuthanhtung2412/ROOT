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

export function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)]
}

export function uniqueCardIds(options: DecreeCardOption[]): string[] {
  return [...new Set(options.map((option) => option.cardId))]
}
