import type Phaser from 'phaser'
import { gameViewSize } from '#game/hiDpi.ts'
import {
  eyrieLeaderTextureKey,
  lookupEyrieLeader,
} from '#assets/eyrieLeaderCatalog.ts'

export type LeaderPickedHandler = (leaderId: string) => void

const CARD_DISPLAY_WIDTH = 150
const CARD_DISPLAY_HEIGHT = 210
const GAP = 16

/**
 * Setup / turmoil: pick Eyrie leader with card art + ability text.
 */
export class LeaderPickOverlay {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly title: Phaser.GameObjects.Text
  private cardNodes: Phaser.GameObjects.GameObject[] = []
  private onPicked: LeaderPickedHandler | null = null
  private loading = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const { width, height } = gameViewSize()
    const veil = scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
      .setInteractive()

    this.title = scene.add
      .text(width / 2, 56, 'Choose Eyrie leader', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f0e6d3',
        backgroundColor: '#0a0a0add',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)

    this.root = scene.add
      .container(0, 0, [veil, this.title])
      .setDepth(250)
      .setVisible(false)
  }

  setOnPicked(handler: LeaderPickedHandler | null): void {
    this.onPicked = handler
  }

  sync(leaderIds: readonly string[] | null): void {
    for (const node of this.cardNodes) {
      node.destroy()
    }
    this.cardNodes = []

    if (leaderIds === null || leaderIds.length === 0) {
      this.root.setVisible(false)
      return
    }

    this.root.setVisible(true)
    void this.loadAndPaint(leaderIds)
  }

  destroy(): void {
    this.root.destroy(true)
  }

  private async loadAndPaint(leaderIds: readonly string[]): Promise<void> {
    if (this.loading) {
      return
    }
    this.loading = true
    try {
      await this.ensureTextures(leaderIds)
      if (!this.root.visible) {
        return
      }
      this.paintCards(leaderIds)
    } finally {
      this.loading = false
    }
  }

  private ensureTextures(leaderIds: readonly string[]): Promise<void> {
    let queued = 0
    for (const leaderId of leaderIds) {
      const info = lookupEyrieLeader(leaderId)
      if (info === null) {
        continue
      }
      const key = eyrieLeaderTextureKey(leaderId)
      if (this.scene.textures.exists(key)) {
        continue
      }
      this.scene.load.image(key, info.imagePath)
      queued += 1
    }
    if (queued === 0) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.scene.load.once('complete', () => {
        resolve()
      })
      if (!this.scene.load.isLoading()) {
        this.scene.load.start()
      }
    })
  }

  private paintCards(leaderIds: readonly string[]): void {
    for (const node of this.cardNodes) {
      node.destroy()
    }
    this.cardNodes = []

    const { width, height } = gameViewSize()
    const totalWidth =
      leaderIds.length * CARD_DISPLAY_WIDTH + (leaderIds.length - 1) * GAP
    const startX = width / 2 - totalWidth / 2 + CARD_DISPLAY_WIDTH / 2
    const centerY = height * 0.48

    leaderIds.forEach((leaderId, index) => {
      const info = lookupEyrieLeader(leaderId)
      const x = startX + index * (CARD_DISPLAY_WIDTH + GAP)
      const key = eyrieLeaderTextureKey(leaderId)

      const slot = this.scene.add.container(x, centerY)

      if (this.scene.textures.exists(key)) {
        const face = this.scene.add
          .image(0, -24, key)
          .setDisplaySize(CARD_DISPLAY_WIDTH, CARD_DISPLAY_HEIGHT)
          .setInteractive({ useHandCursor: true })
        face.on('pointerdown', () => {
          this.onPicked?.(leaderId)
        })
        slot.add(face)
      } else {
        const fallback = this.scene.add
          .rectangle(0, -24, CARD_DISPLAY_WIDTH, CARD_DISPLAY_HEIGHT, 0x334455, 1)
          .setStrokeStyle(2, 0xf0e6d3, 0.8)
          .setInteractive({ useHandCursor: true })
        fallback.on('pointerdown', () => {
          this.onPicked?.(leaderId)
        })
        const name = this.scene.add
          .text(0, -24, info?.name ?? leaderId, {
            fontFamily: 'Georgia, serif',
            fontSize: '16px',
            color: '#f0e6d3',
            align: 'center',
            wordWrap: { width: CARD_DISPLAY_WIDTH - 12 },
          })
          .setOrigin(0.5)
        slot.add([fallback, name])
      }

      const caption = this.scene.add
        .text(
          0,
          CARD_DISPLAY_HEIGHT / 2 + 8,
          [
            info?.name ?? leaderId,
            info !== null ? `Viziers: ${info.decree}` : '',
            info?.ability ?? '',
          ]
            .filter((line) => line.length > 0)
            .join('\n'),
          {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#f0e6d3',
            align: 'center',
            backgroundColor: '#0a0a0add',
            padding: { x: 6, y: 4 },
            wordWrap: { width: CARD_DISPLAY_WIDTH + 20 },
          },
        )
        .setOrigin(0.5, 0)
      slot.add(caption)

      this.root.add(slot)
      this.cardNodes.push(slot)
    })
  }
}
