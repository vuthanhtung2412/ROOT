import type Phaser from 'phaser'
import {
  GAME_ASSET_KEYS,
  pieceTokenTextureKey,
} from '../assets/gameAssets.ts'
import { PIECE_DRAW } from '../game/theme.ts'

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

function factionTextureKey(factionId: string): string {
  if (factionId === 'eyrie') {
    return GAME_ASSET_KEYS.factionEyrie
  }
  return GAME_ASSET_KEYS.factionMarquise
}

function textureKeyForStack(stack: PieceStackViewModel): string {
  const tokenKey = pieceTokenTextureKey(stack.kind, stack.type)
  if (tokenKey !== null) {
    return tokenKey
  }
  return factionTextureKey(stack.factionId)
}

/**
 * Stack pieces by owner + kind + type, then draw faction icon + count.
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

/**
 * Token/building art when known; else faction icon. Count overlay.
 */
export function drawPieceStack(
  scene: Phaser.Scene,
  stack: PieceStackViewModel,
  position: PieceDrawPosition,
): Phaser.GameObjects.Container {
  const usesTokenArt = pieceTokenTextureKey(stack.kind, stack.type) !== null
  const size = usesTokenArt
    ? PIECE_DRAW.buildingIconSize
    : stack.kind === 'warrior'
      ? PIECE_DRAW.iconSize
      : PIECE_DRAW.buildingIconSize
  const textureKey = textureKeyForStack(stack)

  const icon = scene.add
    .image(0, 0, textureKey)
    .setDisplaySize(size, size)
    .setOrigin(0.5)

  const ring = scene.add
    .circle(0, 0, size / 2 + 2, 0x000000, 0)
    .setStrokeStyle(2, stack.color, 0.95)

  const countText = scene.add
    .text(0, 0, String(stack.count), {
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.round(size * 0.55)}px`,
      color: '#ffffff',
      stroke: '#1a1a1a',
      strokeThickness: 4,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)

  return scene.add.container(position.x, position.y, [icon, ring, countText])
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
