import type Phaser from 'phaser'
import { PIECE_DRAW } from '../game/theme.ts'

export type PieceViewModel = {
  id: string
  kind: string
  owner: number
  type?: string
  color: number
}

export type PieceDrawPosition = {
  x: number
  y: number
}

/**
 * Vector piece glyphs (no sprite sheet). Phaser never owns game logic —
 * only draws view-models from API state.
 */
export function drawPieceGlyph(
  scene: Phaser.Scene,
  piece: PieceViewModel,
  position: PieceDrawPosition,
): Phaser.GameObjects.GameObject {
  if (piece.kind === 'warrior') {
    return scene.add.circle(
      position.x,
      position.y,
      PIECE_DRAW.warriorRadius,
      piece.color,
      1,
    )
  }

  if (piece.kind === 'building') {
    return drawBuilding(scene, piece, position)
  }

  if (piece.kind === 'token') {
    return scene.add
      .triangle(
        position.x,
        position.y,
        0,
        -PIECE_DRAW.tokenRadius,
        PIECE_DRAW.tokenRadius,
        PIECE_DRAW.tokenRadius,
        -PIECE_DRAW.tokenRadius,
        PIECE_DRAW.tokenRadius,
        piece.color,
        1,
      )
      .setStrokeStyle(1, 0x1a1a1a, 0.8)
  }

  // pawn / unknown
  return scene.add
    .rectangle(
      position.x,
      position.y,
      PIECE_DRAW.buildingSize,
      PIECE_DRAW.buildingSize,
      piece.color,
      1,
    )
    .setStrokeStyle(1, 0x1a1a1a, 0.8)
}

function drawBuilding(
  scene: Phaser.Scene,
  piece: PieceViewModel,
  position: PieceDrawPosition,
): Phaser.GameObjects.GameObject {
  const size = PIECE_DRAW.buildingSize
  if (piece.type === 'roost') {
    return scene.add
      .star(position.x, position.y, 5, size / 4, size / 2, piece.color, 1)
      .setStrokeStyle(1, 0x1a1a1a, 0.8)
  }
  if (piece.type === 'keep') {
    return scene.add
      .rectangle(position.x, position.y, size, size * 1.2, piece.color, 1)
      .setStrokeStyle(2, 0xf0e6d3, 0.9)
  }
  // sawmill / workshop / recruiter / base
  return scene.add
    .rectangle(position.x, position.y, size, size, piece.color, 1)
    .setStrokeStyle(1, 0x1a1a1a, 0.8)
}

export function stackOffsets(count: number): PieceDrawPosition[] {
  const offsets: PieceDrawPosition[] = []
  const columns = Math.ceil(Math.sqrt(count))
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
