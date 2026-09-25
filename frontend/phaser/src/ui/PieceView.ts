import {
  GAME_ASSET_KEYS,
  pieceTokenTextureKey,
} from '#assets/gameAssets.ts'
import { PIECE_DRAW } from '#game/theme.ts'

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

/**
 * Stack pieces by owner + kind + type for board rendering.
 */
export function groupPiecesIntoStacks(
  pieces: readonly PieceViewModel[],
): PieceStackViewModel[] {
  const stacks = new Map<string, PieceStackViewModel>()
  for (const piece of pieces) {
    const typeKey = piece.type ?? ''
    const key = `${piece.owner}:${piece.kind}:${typeKey}`
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
  if (factionId === 'eyrie') {
    return GAME_ASSET_KEYS.factionEyrie
  }
  return GAME_ASSET_KEYS.factionMarquise
}

export function textureKeyForPieceStack(stack: PieceStackViewModel): string {
  const tokenKey = pieceTokenTextureKey(stack.kind, stack.type)
  if (tokenKey !== null) {
    return tokenKey
  }
  return factionTextureKeyForStack(stack.factionId)
}
