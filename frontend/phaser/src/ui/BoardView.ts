import type Phaser from 'phaser'
import { GAME_ASSET_KEYS } from '#assets/gameAssets.ts'
import {
  FALL_BOARD_LAYOUT,
  fallClearingSuit,
  layoutToPixelHitTargets,
  type BoardLayout,
  type ClearingPixelHitTarget,
  type ClearingSuit,
} from '#game/boardLayout.ts'
import {
  clearingHasRuin,
  clearingOpenSlotCount,
  RUIN_MARKER_LABEL,
} from '#game/clearingIndicators.ts'
import { clearingRuler } from '#game/clearingRuler.ts'
import { gameViewSize } from '#game/hiDpi.ts'
import { factionColorForSeat } from '#game/theme.ts'
import {
  drawPieceStack,
  groupPiecesIntoStacks,
  stackOffsets,
  type PieceViewModel,
} from '#ui/PieceView.ts'

export type ClearingSelectedHandler = (clearingId: number) => void

export type BoardClearingPieces = {
  pieces: Array<{
    id: string
    kind: string
    owner: number
    type?: string
  }>
  ruin?: { items: string[] }
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
  suitIcon: Phaser.GameObjects.Image | null
}

function suitTextureKey(suit: ClearingSuit): string {
  if (suit === 'fox') {
    return GAME_ASSET_KEYS.suitFox
  }
  if (suit === 'mouse') {
    return GAME_ASSET_KEYS.suitMouse
  }
  return GAME_ASSET_KEYS.suitRabbit
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
  private rulerByClearing: ReadonlyMap<number, number | null> = new Map()
  private factions: readonly string[] = []
  private pieceNodes: Phaser.GameObjects.GameObject[] = []
  private indicatorNodes: Phaser.GameObjects.GameObject[] = []

  constructor(options: BoardViewOptions) {
    this.scene = options.scene
    this.onClearingSelected = options.onClearingSelected ?? null

    const { width, height } = gameViewSize()
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
    this.factions = factions
    this.rulerByClearing = this.computeRulers(clearings, factions)

    for (const node of this.pieceNodes) {
      node.destroy()
    }
    this.pieceNodes = []

    this.syncClearingIndicators(clearings)

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
    this.paintHighlights()
  }

  private computeRulers(
    clearings: readonly BoardClearingPieces[],
    factions: readonly string[],
  ): Map<number, number | null> {
    const rulers = new Map<number, number | null>()
    for (const visual of this.clearingVisuals) {
      const clearing = clearings[visual.clearingId]
      if (clearing === undefined) {
        rulers.set(visual.clearingId, null)
        continue
      }
      rulers.set(visual.clearingId, clearingRuler(clearing, factions))
    }
    return rulers
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
    // Leave room for PlayerRail (left) + ActionTray (right); center in remaining band.
    const boardWidth = viewWidth * 0.74
    const boardHeight = viewHeight * 0.82
    const texture = this.mapImage.texture.getSourceImage()
    const scale = Math.min(
      boardWidth / texture.width,
      boardHeight / texture.height,
    )
    this.mapImage.setScale(scale)
    this.mapImage.setPosition(viewWidth * 0.5, viewHeight * 0.44)
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
        if (!this.highlightedClearingIds.has(target.clearingId)) {
          return
        }
        ring.setStrokeStyle(3, 0xffe08a, 0.9)
      })

      hitArea.on('pointerout', () => {
        this.paintOneRing(target.clearingId, ring)
      })

      const suitIcon = this.createSuitIconBelowClearing(target)

      this.root.add(ring)
      this.root.add(hitArea)
      if (suitIcon !== null) {
        this.root.add(suitIcon)
      }
      this.clearingVisuals.push({
        clearingId: target.clearingId,
        hitArea,
        ring,
        suitIcon,
      })
    }
  }

  private createSuitIconBelowClearing(
    target: ClearingPixelHitTarget,
  ): Phaser.GameObjects.Image | null {
    const suit = fallClearingSuit(target.clearingId)
    if (suit === null) {
      return null
    }
    const textureKey = suitTextureKey(suit)
    if (!this.scene.textures.exists(textureKey)) {
      return null
    }
    const image = this.scene.add
      .image(target.centerX, target.centerY + target.radius + 2, textureKey)
      .setOrigin(0.5, 0)
    const source = image.texture.getSourceImage()
    const maxSide = target.radius * 0.45
    const scale = Math.min(maxSide / source.width, maxSide / source.height)
    image.setDisplaySize(source.width * scale, source.height * scale)
    return image
  }

  private syncClearingIndicators(clearings: readonly BoardClearingPieces[]): void {
    for (const node of this.indicatorNodes) {
      node.destroy()
    }
    this.indicatorNodes = []

    for (const visual of this.clearingVisuals) {
      const clearing = clearings[visual.clearingId]
      if (clearingHasRuin(clearing)) {
        const ruinBadge = this.scene.add
          .text(
            visual.hitArea.x - visual.hitArea.radius * 0.55,
            visual.hitArea.y - visual.hitArea.radius * 0.75,
            RUIN_MARKER_LABEL,
            {
              fontFamily: 'Georgia, serif',
              fontSize: '13px',
              color: '#1a1a1a',
              backgroundColor: '#c8a45c',
              padding: { x: 4, y: 2 },
              fontStyle: 'bold',
            },
          )
          .setOrigin(0.5)
        this.pieceLayer.add(ruinBadge)
        this.indicatorNodes.push(ruinBadge)
      }

      const openSlots = clearingOpenSlotCount(visual.clearingId, clearing)
      if (openSlots > 0) {
        const slotBadge = this.scene.add
          .text(
            visual.hitArea.x + visual.hitArea.radius * 0.55,
            visual.hitArea.y - visual.hitArea.radius * 0.75,
            String(openSlots),
            {
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#f0e6d3',
              backgroundColor: '#1a2438cc',
              padding: { x: 4, y: 2 },
              fontStyle: 'bold',
            },
          )
          .setOrigin(0.5)
        this.pieceLayer.add(slotBadge)
        this.indicatorNodes.push(slotBadge)
      }
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
    const rulerSeat = this.rulerByClearing.get(clearingId) ?? null
    if (rulerSeat !== null) {
      const color = factionColorForSeat(rulerSeat, this.factions)
      ring.setStrokeStyle(3, color, 0.95)
      return
    }
    ring.setStrokeStyle(2, 0xf0e6d3, 0.35)
  }
}
