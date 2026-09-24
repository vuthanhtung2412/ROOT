import type Phaser from 'phaser'
import {
  EYRIE_BOARD_LAYOUT,
  MARQUISE_BOARD_LAYOUT,
  placeBoardImage,
  type BoardImagePlacement,
  type FactionBoardPixelLayout,
} from '#assets/factionBoardLayout.ts'
import { gameViewSize } from '#game/hiDpi.ts'
import { FactionBoardContentBuilder } from '#ui/factionBoardContentBuilder.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

const MODAL_DEPTH: number = 360

/** Board fills most of the viewport; overlays use helper layout px. */
const BOARD_MAX_WIDTH_RATIO: number = 0.96
const BOARD_MAX_HEIGHT_RATIO: number = 0.94
const BOARD_TOP_RATIO: number = 0.02

/**
 * Steam-inspired faction board: board art + layout-baked tokens/supply/leader.
 */
export class FactionBoardModal {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly contentBuilder: FactionBoardContentBuilder
  private contentNodes: Phaser.GameObjects.GameObject[] = []
  private visible: boolean = false
  private currentSeat: number | null = null
  private showGeneration: number = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setDepth(MODAL_DEPTH).setVisible(false)
    this.contentBuilder = new FactionBoardContentBuilder(scene)
  }

  isOpen(): boolean {
    return this.visible
  }

  openSeat(): number | null {
    return this.currentSeat
  }

  show(view: FactionBoardViewModel): void {
    this.clearContent()
    this.currentSeat = view.seat
    this.visible = true
    this.root.setVisible(true)
    this.showGeneration += 1
    const generation: number = this.showGeneration

    const { width, height }: { width: number; height: number } = gameViewSize()
    const veil: Phaser.GameObjects.Rectangle = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive()
    veil.on('pointerdown', (): void => {
      this.hide()
    })

    const layout: FactionBoardPixelLayout =
      view.kind === 'marquise' ? MARQUISE_BOARD_LAYOUT : EYRIE_BOARD_LAYOUT
    const placement: BoardImagePlacement = placeBoardImage({
      viewWidth: width,
      viewHeight: height,
      naturalWidth: layout.naturalWidth,
      naturalHeight: layout.naturalHeight,
      maxWidthRatio: BOARD_MAX_WIDTH_RATIO,
      maxHeightRatio: BOARD_MAX_HEIGHT_RATIO,
      topRatio: BOARD_TOP_RATIO,
    })

    const children: Phaser.GameObjects.GameObject[] = [veil]
    children.push(...this.contentBuilder.buildBoardArt(view, placement))
    children.push(
      ...this.contentBuilder.buildLayoutOverlays(view, layout, placement),
    )

    const closeButton: Phaser.GameObjects.Text = this.scene.add
      .text(width - 12, 10, '✕', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#1a1a1a',
        backgroundColor: '#f0e6d3',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
    closeButton.on('pointerdown', (): void => {
      this.hide()
    })
    children.push(closeButton)

    this.root.add(children)
    this.contentNodes = children

    if (view.kind === 'eyrie' && view.leader !== null) {
      void this.contentBuilder
        .ensureLeaderTexture(view.leader.id)
        .then((): void => {
          if (generation !== this.showGeneration || !this.visible) {
            return
          }
          const leaderNodes: Phaser.GameObjects.GameObject[] =
            this.contentBuilder.buildLeaderSlot(
              view,
              layout,
              placement,
            )
          if (leaderNodes.length === 0) {
            return
          }
          this.root.add(leaderNodes)
          this.contentNodes = [...this.contentNodes, ...leaderNodes]
        })
    }
  }

  hide(): void {
    this.visible = false
    this.currentSeat = null
    this.showGeneration += 1
    this.clearContent()
    this.root.setVisible(false)
  }

  destroy(): void {
    this.root.destroy(true)
  }

  private clearContent(): void {
    for (const node of this.contentNodes) {
      node.destroy()
    }
    this.contentNodes = []
    this.root.removeAll(false)
  }
}
