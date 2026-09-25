import type Phaser from 'phaser'
import {
  cardTextureKey,
  lookupCardCatalog,
  type CardCatalogEntry,
} from '#assets/gameAssets.ts'

export type CardViewModel = {
  id: string
  defId: string
  selected: boolean
  dimmed: boolean
}

export type CardSelectedHandler = (cardId: string) => void

export type CardHoldHandler = (card: {
  cardId: string
  defId: string
  catalog: CardCatalogEntry
}) => void

const CARD_WIDTH = 78
const CARD_HEIGHT = 110
const HOLD_MS = 350
const SELECTED_RAISE_OFFSET = -18

export class CardView {
  readonly container: Phaser.GameObjects.Container
  readonly cardId: string
  readonly defId: string
  private readonly face: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  private holdTimer: Phaser.Time.TimerEvent | null = null
  private holdFired = false
  private baseX = 0
  private baseY = 0
  private selected = false

  constructor(
    scene: Phaser.Scene,
    viewModel: CardViewModel,
    onSelected: CardSelectedHandler | null,
    onHold: CardHoldHandler | null,
  ) {
    this.cardId = viewModel.id
    this.defId = viewModel.defId

    const textureKey = cardTextureKey(viewModel.defId)
    if (scene.textures.exists(textureKey)) {
      this.face = scene.add
        .image(0, 0, textureKey)
        .setDisplaySize(CARD_WIDTH, CARD_HEIGHT)
        .setOrigin(0.5)
    } else {
      this.face = scene.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x444444, 1)
    }

    // Art already has white border — no matte frame.
    this.container = scene.add.container(0, 0, [this.face])
    this.container.setSize(CARD_WIDTH, CARD_HEIGHT)
    this.container.setAlpha(viewModel.dimmed ? 0.45 : 1)
    this.selected = viewModel.selected
    this.applySelectedOffset()

    this.face.setInteractive({ useHandCursor: true })

    this.face.on('pointerdown', () => {
      this.holdFired = false
      this.clearHoldTimer()
      if (onHold !== null) {
        const catalog = lookupCardCatalog(viewModel.defId)
        if (catalog !== null) {
          this.holdTimer = scene.time.delayedCall(HOLD_MS, () => {
            this.holdFired = true
            onHold({
              cardId: viewModel.id,
              defId: viewModel.defId,
              catalog,
            })
          })
        }
      }
    })

    this.face.on('pointerup', () => {
      this.clearHoldTimer()
      if (!this.holdFired && onSelected !== null) {
        onSelected(viewModel.id)
      }
    })

    this.face.on('pointerout', () => {
      this.clearHoldTimer()
    })
  }

  setPosition(x: number, y: number): void {
    this.baseX = x
    this.baseY = y
    this.applySelectedOffset()
  }

  sync(viewModel: CardViewModel): void {
    this.container.setAlpha(viewModel.dimmed ? 0.45 : 1)
    this.selected = viewModel.selected
    this.applySelectedOffset()
  }

  destroy(): void {
    this.clearHoldTimer()
    this.container.destroy(true)
  }

  private applySelectedOffset(): void {
    this.container.setPosition(
      this.baseX,
      this.baseY + (this.selected ? SELECTED_RAISE_OFFSET : 0),
    )
  }

  private clearHoldTimer(): void {
    if (this.holdTimer !== null) {
      this.holdTimer.remove(false)
      this.holdTimer = null
    }
  }
}
