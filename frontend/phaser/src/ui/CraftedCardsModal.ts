import type Phaser from 'phaser'
import { cardTextureKey } from '#assets/gameAssets.ts'
import { gameViewSize } from '#game/hiDpi.ts'

export type CraftedCardFace = {
  id: string
  defId: string
}

export type CraftedCardsModalContent = {
  seat: number
  faction: string
  cards: readonly CraftedCardFace[]
}

const MODAL_DEPTH = 380
/** Root card face aspect (width / height). */
const CARD_ASPECT_RATIO = 195 / 273
const CARD_GAP = 16
const PANEL_HEIGHT_RATIO = 0.72
const PANEL_MIN_HEIGHT = 480
const PANEL_HORIZONTAL_PADDING = 24
const PANEL_VERTICAL_PADDING = 12
const PANEL_WIDTH_RATIO = 0.94
const PANEL_MAX_WIDTH = 1180
const SCROLL_WHEEL_FACTOR = 0.55
const EMPTY_MESSAGE = 'No permanent crafted cards'

/**
 * Popover gallery of a player's permanent crafted cards (play-area faces).
 * Cards fill the panel height; horizontal drag / wheel scroll.
 */
export class CraftedCardsModal {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private contentNodes: Phaser.GameObjects.GameObject[] = []
  private scrollStrip: Phaser.GameObjects.Container | null = null
  private scrollMaskGraphics: Phaser.GameObjects.Graphics | null = null
  private scrollOffsetX = 0
  private minScrollOffsetX = 0
  private stripViewportLeft = 0
  private stripViewportWidth = 0
  private stripCenterY = 0
  private contentWidth = 0
  private dragPointerId: number | null = null
  private dragStartX = 0
  private dragStartScrollOffsetX = 0
  private visible = false
  private currentSeat: number | null = null
  private readonly onWheel: (
    pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
  ) => void
  private readonly onPointerMove: (pointer: Phaser.Input.Pointer) => void
  private readonly onPointerUp: (pointer: Phaser.Input.Pointer) => void

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setDepth(MODAL_DEPTH).setVisible(false)
    this.onWheel = (_pointer, _currentlyOver, deltaX, deltaY) => {
      if (!this.visible || this.scrollStrip === null) {
        return
      }
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY
      this.applyScrollDelta(-delta * SCROLL_WHEEL_FACTOR)
    }
    this.onPointerMove = (pointer) => {
      if (!this.visible || this.dragPointerId !== pointer.id) {
        return
      }
      const delta = pointer.x - this.dragStartX
      this.setScrollOffset(this.dragStartScrollOffsetX + delta)
    }
    this.onPointerUp = (pointer) => {
      if (this.dragPointerId === pointer.id) {
        this.dragPointerId = null
      }
    }
    this.scene.input.on('wheel', this.onWheel)
    this.scene.input.on('pointermove', this.onPointerMove)
    this.scene.input.on('pointerup', this.onPointerUp)
  }

  isOpen(): boolean {
    return this.visible
  }

  openSeat(): number | null {
    return this.currentSeat
  }

  show(content: CraftedCardsModalContent): void {
    this.clearContent()
    this.currentSeat = content.seat
    this.visible = true
    this.root.setVisible(true)
    this.scrollOffsetX = 0

    const { width, height } = gameViewSize()
    const panelWidth = Math.min(width * PANEL_WIDTH_RATIO, PANEL_MAX_WIDTH)
    const panelHeight = Math.max(height * PANEL_HEIGHT_RATIO, PANEL_MIN_HEIGHT)
    const panelCenterX = width / 2
    const panelCenterY = height / 2
    const panelTop = panelCenterY - panelHeight / 2
    const cardDisplayHeight = panelHeight - PANEL_VERTICAL_PADDING * 2
    const cardDisplayWidth = cardDisplayHeight * CARD_ASPECT_RATIO

    const veil = this.scene.add
      .rectangle(panelCenterX, panelCenterY, width, height, 0x000000, 0.7)
      .setInteractive()
    veil.on('pointerdown', () => {
      this.hide()
    })

    const panel = this.scene.add
      .rectangle(
        panelCenterX,
        panelCenterY,
        panelWidth,
        panelHeight,
        0x1f1a14,
        0.98,
      )
      .setStrokeStyle(2, 0xf0e6d3, 0.9)
      .setInteractive()

    const title = this.scene.add
      .text(
        panelCenterX - panelWidth / 2 + 16,
        panelTop + 10,
        `${content.faction} · crafted cards`,
        {
          fontFamily: 'Georgia, serif',
          fontSize: '16px',
          color: '#f0e6d3',
          backgroundColor: '#1f1a14cc',
          padding: { x: 8, y: 4 },
        },
      )
      .setOrigin(0, 0)
      .setDepth(1)

    const children: Phaser.GameObjects.GameObject[] = [veil, panel, title]

    this.stripViewportLeft =
      panelCenterX - panelWidth / 2 + PANEL_HORIZONTAL_PADDING
    this.stripViewportWidth = panelWidth - PANEL_HORIZONTAL_PADDING * 2
    this.stripCenterY = panelCenterY

    if (content.cards.length === 0) {
      const empty = this.scene.add
        .text(panelCenterX, this.stripCenterY, EMPTY_MESSAGE, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#9a9a9a',
        })
        .setOrigin(0.5)
      children.push(empty)
      this.root.add(children)
      this.contentNodes = children
      return
    }

    this.scrollStrip = this.scene.add.container(
      this.stripViewportLeft,
      this.stripCenterY,
    )
    this.contentWidth = 0
    content.cards.forEach((card, index) => {
      const x =
        cardDisplayWidth / 2 + index * (cardDisplayWidth + CARD_GAP)
      const faceNodes = this.buildCardFace(
        card,
        x,
        cardDisplayWidth,
        cardDisplayHeight,
      )
      for (const node of faceNodes) {
        this.scrollStrip?.add(node)
      }
      this.contentWidth = x + cardDisplayWidth / 2
    })

    this.minScrollOffsetX = Math.min(
      0,
      this.stripViewportWidth - this.contentWidth,
    )
    this.scrollOffsetX = 0
    this.scrollStrip.setX(this.stripViewportLeft + this.scrollOffsetX)

    this.scrollMaskGraphics = this.scene.add.graphics()
    this.scrollMaskGraphics.fillStyle(0xffffff, 1)
    this.scrollMaskGraphics.fillRect(
      this.stripViewportLeft,
      panelTop + PANEL_VERTICAL_PADDING,
      this.stripViewportWidth,
      cardDisplayHeight,
    )
    const mask = this.scrollMaskGraphics.createGeometryMask()
    this.scrollStrip.setMask(mask)
    this.scrollMaskGraphics.setVisible(false)

    const dragSurface = this.scene.add
      .rectangle(
        panelCenterX,
        this.stripCenterY,
        this.stripViewportWidth,
        cardDisplayHeight,
        0x000000,
        0.001,
      )
      .setInteractive({ useHandCursor: true, draggable: false })
    dragSurface.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragPointerId = pointer.id
      this.dragStartX = pointer.x
      this.dragStartScrollOffsetX = this.scrollOffsetX
    })

    children.push(this.scrollStrip, this.scrollMaskGraphics, dragSurface)
    this.root.add(children)
    this.contentNodes = children
  }

  hide(): void {
    this.clearContent()
    this.currentSeat = null
    this.visible = false
    this.root.setVisible(false)
  }

  destroy(): void {
    this.scene.input.off('wheel', this.onWheel)
    this.scene.input.off('pointermove', this.onPointerMove)
    this.scene.input.off('pointerup', this.onPointerUp)
    this.root.destroy(true)
  }

  private buildCardFace(
    card: CraftedCardFace,
    x: number,
    cardDisplayWidth: number,
    cardDisplayHeight: number,
  ): Phaser.GameObjects.GameObject[] {
    const textureKey = cardTextureKey(card.defId)
    if (this.scene.textures.exists(textureKey)) {
      return [
        this.scene.add
          .image(x, 0, textureKey)
          .setDisplaySize(cardDisplayWidth, cardDisplayHeight)
          .setOrigin(0.5),
      ]
    }
    return [
      this.scene.add
        .rectangle(x, 0, cardDisplayWidth, cardDisplayHeight, 0x444444, 1)
        .setStrokeStyle(2, 0xf0e6d3, 0.7),
    ]
  }

  private applyScrollDelta(delta: number): void {
    this.setScrollOffset(this.scrollOffsetX + delta)
  }

  private setScrollOffset(nextOffset: number): void {
    if (this.scrollStrip === null) {
      return
    }
    this.scrollOffsetX = clampScrollOffset(
      nextOffset,
      this.minScrollOffsetX,
      0,
    )
    this.scrollStrip.setX(this.stripViewportLeft + this.scrollOffsetX)
  }

  private clearContent(): void {
    this.dragPointerId = null
    this.scrollStrip = null
    this.scrollMaskGraphics = null
    for (const node of this.contentNodes) {
      node.destroy()
    }
    this.contentNodes = []
    this.root.removeAll(false)
  }
}

function clampScrollOffset(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (value < minimum) {
    return minimum
  }
  if (value > maximum) {
    return maximum
  }
  return value
}
