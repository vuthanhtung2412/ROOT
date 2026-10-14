export type ForestPawnMarker = {
  forestIndex: number
  seat: number
  factionId: string
  /** Vagabond character id — picks the meeple art; null = default. */
  character: string | null
}

export function isVagabondBoardWithForest(
  board: unknown,
): board is { kind: 'vagabond'; forest: number } {
  if (typeof board !== 'object' || board === null) return false
  if (Reflect.get(board, 'kind') !== 'vagabond') return false
  const forest = Reflect.get(board, 'forest')
  return typeof forest === 'number'
}
