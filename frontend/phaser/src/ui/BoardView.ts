import type Phaser from 'phaser'
import { GAME_ASSET_KEYS } from '../assets/gameAssets.ts'
import {
  FALL_BOARD_LAYOUT,
  layoutToPixelHitTargets,
  type BoardLayout,
  type ClearingPixelHitTarget,
} from '../game/boardLayout.ts'
import { factionColorForSeat } from '../game/theme.ts'
import {
  drawPieceStack,
  groupPiecesIntoStacks,
  stackOffsets,
  type PieceViewModel,
} from './PieceView.ts'

export type ClearingSelectedHandler = (clearingId: number) => void

export type BoardClearingPieces = {
  pieces: Array<{
    id: string
    kind: string
    owner: number
    type?: string
  }>
}

export type BoardViewOptions = {
  scene: Phaser.Scene
  layout?: BoardLayout
  onClearingSelected?: ClearingSelectedHandler
}

type ClearingVisual = {
  clearingId: number
  hitArea: Phaser.GameObjects.Arc
  ring: Phaser.GameObjects.Arc
}

/**
 * Autumn map image + circular clearing hit targets + vector pieces.
 */
export class BoardView {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly pieceLayer: Phaser.GameObjects.Container
  private readonly mapImage: Phaser.GameObjects.Image
  private readonly clearingVisuals: ClearingVisual[] = []
  private onClearingSelected: ClearingSelectedHandler | null
  private highlightedClearingIds: ReadonlySet<number> = new Set()
  private pieceNodes: Phaser.GameObjects.GameObject[] = []

  constructor(options: BoardViewOptions) {
    this.scene = options.scene
    this.onClearingSelected = options.onClearingSelected ?? null

    const { width, height } = this.scene.scale
    this.root = this.scene.add.container(0, 0)
    this.pieceLayer = this.scene.add.container(0, 0)

    this.mapImage = this.scene.add
      .image(width / 2, height / 2, GAME_ASSET_KEYS.autumnMap)
      .setOrigin(0.5)

    this.fitMapToBoardArea(width, height)
    this.root.add(this.mapImage)

    const layout = options.layout ?? FALL_BOARD_LAYOUT
    this.buildClearingTargets(layout)
    this.root.add(this.pieceLayer)
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.root
  }

  setClearingSelectedHandler(handler: ClearingSelectedHandler | null): void {
    this.onClearingSelected = handler
  }

  setHighlightedClearings(clearingIds: readonly number[]): void {
    this.highlightedClearingIds = new Set(clearingIds)
    this.paintHighlights()
  }

  syncPieces(
    clearings: readonly BoardClearingPieces[],
    factions: readonly string[],
  ): void {
    for (const node of this.pieceNodes) {
      node.destroy()
    }
    this.pieceNodes = []

    for (const visual of this.clearingVisuals) {
      const clearing = clearings[visual.clearingId]
      if (clearing === undefined) {
        continue
      }
      const viewModels: PieceViewModel[] = clearing.pieces.map((piece) => {
        const factionId = factions[piece.owner] ?? 'marquise'
        const viewModel: PieceViewModel = {
          id: piece.id,
          kind: piece.kind,
          owner: piece.owner,
          color: factionColorForSeat(piece.owner, factions),
          factionId,
        }
        if (piece.type !== undefined) {
          return { ...viewModel, type: piece.type }
        }
        return viewModel
      })
      const stacks = groupPiecesIntoStacks(viewModels)
      const offsets = stackOffsets(stacks.length)
      for (let index = 0; index < stacks.length; index += 1) {
        const stack = stacks[index]
        const offset = offsets[index]
        if (stack === undefined || offset === undefined) {
          continue
        }
        const glyph = drawPieceStack(this.scene, stack, {
          x: visual.hitArea.x + offset.x,
          y: visual.hitArea.y + offset.y,
        })
        this.pieceLayer.add(glyph)
        this.pieceNodes.push(glyph)
      }
    }
  }

  getHitTargets(): ClearingPixelHitTarget[] {
    return this.clearingVisuals.map((visual) => ({
      clearingId: visual.clearingId,
      centerX: visual.hitArea.x,
      centerY: visual.hitArea.y,
      radius: visual.hitArea.radius,
    }))
  }

  destroy(): void {
    this.root.destroy(true)
  }

  private fitMapToBoardArea(viewWidth: number, viewHeight: number): void {
    const boardWidth = viewWidth * 0.62
    const boardHeight = viewHeight * 0.78
    const texture = this.mapImage.texture.getSourceImage()
    const scale = Math.min(
      boardWidth / texture.width,
      boardHeight / texture.height,
    )
    this.mapImage.setScale(scale)
    this.mapImage.setPosition(viewWidth * 0.38, viewHeight * 0.42)
  }

  private buildClearingTargets(layout: BoardLayout): void {
    const displayWidth = this.mapImage.displayWidth
    const displayHeight = this.mapImage.displayHeight
    const originX = this.mapImage.x - displayWidth / 2
    const originY = this.mapImage.y - displayHeight / 2

    const targets = layoutToPixelHitTargets(layout, {
      originX,
      originY,
      width: displayWidth,
      height: displayHeight,
    })

    for (const target of targets) {
      const ring = this.scene.add
        .circle(target.centerX, target.centerY, target.radius, 0x000000, 0)
        .setStrokeStyle(2, 0xf0e6d3, 0.35)

      const hitArea = this.scene.add
        .circle(target.centerX, target.centerY, target.radius, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })

      hitArea.on('pointerdown', () => {
        if (this.onClearingSelected !== null) {
          this.onClearingSelected(target.clearingId)
        }
      })

      hitArea.on('pointerover', () => {
        ring.setStrokeStyle(3, 0xffe08a, 0.9)
      })

      hitArea.on('pointerout', () => {
        this.paintOneRing(target.clearingId, ring)
      })

      this.root.add(ring)
      this.root.add(hitArea)
      this.clearingVisuals.push({
        clearingId: target.clearingId,
        hitArea,
        ring,
      })
    }
  }

  private paintHighlights(): void {
    for (const visual of this.clearingVisuals) {
      this.paintOneRing(visual.clearingId, visual.ring)
    }
  }

  private paintOneRing(
    clearingId: number,
    ring: Phaser.GameObjects.Arc,
  ): void {
    if (this.highlightedClearingIds.has(clearingId)) {
      ring.setStrokeStyle(3, 0x7ec8ff, 1)
      return
    }
    ring.setStrokeStyle(2, 0xf0e6d3, 0.35)
  }
}
