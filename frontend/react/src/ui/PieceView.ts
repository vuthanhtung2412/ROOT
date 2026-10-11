import {
  factionTextureKey,
  pieceTokenTextureKey,
} from '#assets/gameAssets.ts'
import { PIECE_DRAW } from '#game/theme.ts'

/** Board piece kind that occupies a building slot (sawmill, roost, garden, …). */
export const BUILDING_PIECE_KIND = 'building'

export type PieceViewModel = {
  id: string
  kind: string
  owner: number
  type?: string
  color: number
  factionId: string
}

export type PieceDrawPosition = {
  x: number
  y: number
}

export type PieceStackViewModel = {
  owner: number
  factionId: string
  kind: string
  type?: string
  count: number
  color: number
  sampleIds: string[]
}

function stackKeyForPiece(piece: PieceViewModel): string {
  // Buildings: one icon each (clearing holds at most 3). Warriors/tokens stack.
  if (piece.kind === BUILDING_PIECE_KIND) {
    return `${BUILDING_PIECE_KIND}:${piece.id}`
  }
  const typeKey = piece.type ?? ''
  return `${String(piece.owner)}:${piece.kind}:${typeKey}`
}

/**
 * Stack pieces by owner + kind + type for board rendering.
 * Buildings stay unstacked so each shows as its own icon.
 */
export function groupPiecesIntoStacks(
  pieces: readonly PieceViewModel[],
): PieceStackViewModel[] {
  const stacks = new Map<string, PieceStackViewModel>()
  for (const piece of pieces) {
    const key = stackKeyForPiece(piece)
    const existing = stacks.get(key)
    if (existing !== undefined) {
      stacks.set(key, {
        ...existing,
        count: existing.count + 1,
        sampleIds: [...existing.sampleIds, piece.id],
      })
      continue
    }
    const stack: PieceStackViewModel = {
      owner: piece.owner,
      factionId: piece.factionId,
      kind: piece.kind,
      count: 1,
      color: piece.color,
      sampleIds: [piece.id],
    }
    if (piece.type !== undefined) {
      stacks.set(key, { ...stack, type: piece.type })
    } else {
      stacks.set(key, stack)
    }
  }
  return [...stacks.values()]
}

export function stackOffsets(count: number): PieceDrawPosition[] {
  const offsets: PieceDrawPosition[] = []
  const columns = Math.ceil(Math.sqrt(Math.max(count, 1)))
  for (let index = 0; index < count; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    offsets.push({
      x: (column - (columns - 1) / 2) * PIECE_DRAW.stackGap,
      y: (row - (columns - 1) / 2) * PIECE_DRAW.stackGap,
    })
  }
  return offsets
}

/** @deprecated Prefer React PieceStack texture helpers. */
export function factionTextureKeyForStack(factionId: string): string {
  return factionTextureKey(factionId)
}

export function textureKeyForPieceStack(stack: PieceStackViewModel): string {
  const tokenKey = pieceTokenTextureKey(stack.kind, stack.type)
  if (tokenKey !== null) {
    return tokenKey
  }
  return factionTextureKey(stack.factionId)
}
