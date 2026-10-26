export type ForestPawnMarker = {
  forestIndex: number
  seat: number
  factionId: string
  /** Vagabond character id — picks the meeple art; null = default. */
  character: string | null
}

/** Boards with a pawn: the Vagabond and the Vagabot (Rootbotics 7). */
const PAWN_BOARD_KINDS: readonly string[] = ['vagabond', 'vagabot']

export function isPawnBoardKind(kind: unknown): boolean {
  return typeof kind === 'string' && PAWN_BOARD_KINDS.includes(kind)
}

export function isVagabondBoardWithForest(
  board: unknown,
): board is { kind: 'vagabond' | 'vagabot'; forest: number } {
  if (typeof board !== 'object' || board === null) return false
  if (!isPawnBoardKind(Reflect.get(board, 'kind'))) return false
  const forest = Reflect.get(board, 'forest')
  return typeof forest === 'number'
}
