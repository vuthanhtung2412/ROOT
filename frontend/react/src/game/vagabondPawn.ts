import {
  isVagabondBoardWithForest,
  type ForestPawnMarker,
} from '#game/forestLayout.ts'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'

const PAWN_PIECE_KIND = 'pawn'

type PlayerWithBoard = { seat: number; faction: string; board?: unknown }

/** Character id on a Vagabond board; null when not chosen / not a Vagabond. */
function vagabondCharacterOf(board: unknown): string | null {
  if (typeof board !== 'object' || board === null) return null
  if (Reflect.get(board, 'kind') !== 'vagabond') return null
  const character: unknown = Reflect.get(board, 'character')
  return typeof character === 'string' ? character : null
}

/**
 * Give each pawn piece its owner's character as `type`, so the map draws the
 * matching meeple (Thief / Tinker / Ranger).
 */
export function stampPawnCharacters<Clearing extends BoardClearingPieces>(
  clearings: readonly Clearing[],
  players: readonly PlayerWithBoard[],
): Clearing[] {
  const characterBySeat = new Map<number, string>()
  for (const player of players) {
    const character = vagabondCharacterOf(player.board)
    if (character !== null) {
      characterBySeat.set(player.seat, character)
    }
  }
  return clearings.map((clearing) => ({
    ...clearing,
    pieces: clearing.pieces.map((piece) => {
      const character = characterBySeat.get(piece.owner)
      if (piece.kind !== PAWN_PIECE_KIND || character === undefined) {
        return piece
      }
      return { ...piece, type: character }
    }),
  }))
}

/** Vagabond pawns standing in a forest (not on a clearing). */
export function forestPawnsFromPlayers(
  players: readonly PlayerWithBoard[],
): ForestPawnMarker[] {
  const markers: ForestPawnMarker[] = []
  for (const player of players) {
    if (!isVagabondBoardWithForest(player.board)) continue
    markers.push({
      forestIndex: player.board.forest,
      seat: player.seat,
      factionId: player.faction,
      character: vagabondCharacterOf(player.board),
    })
  }
  return markers
}
