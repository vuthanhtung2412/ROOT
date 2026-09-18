import type Phaser from 'phaser'
import type { CardCatalogEntry } from '../assets/gameAssets.ts'
import { cardTextureKey } from '../assets/gameAssets.ts'

export type CardDetailContent = {
  defId: string
  catalog: CardCatalogEntry
}

/**
 * Hold-to-inspect card: large face + name + rules text.
 */
export class CardDetailOverlay {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private visible = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setDepth(400).setVisible(false)
  }

  show(content: CardDetailContent): void {
    this.root.removeAll(true)
    const { width, height } = this.scene.scale

    const dimmer = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
      .setInteractive()
    dimmer.on('pointerdown', () => {
      this.hide()
    })

    const panelWidth = 420
    const panelHeight = 520
    const panel = this.scene.add
      .rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x1f1a14, 0.98)
      .setStrokeStyle(2, 0xf0e6d3, 0.9)

    const textureKey = cardTextureKey(content.defId)
    const children: Phaser.GameObjects.GameObject[] = [dimmer, panel]

    if (this.scene.textures.exists(textureKey)) {
      const face = this.scene.add
        .image(width / 2, height / 2 - 70, textureKey)
        .setDisplaySize(220, 310)
        .setOrigin(0.5)
      children.push(face)
    }

    const title = this.scene.add
      .text(width / 2, height / 2 + 120, content.catalog.name, {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f0e6d3',
        align: 'center',
        wordWrap: { width: panelWidth - 40 },
      })
      .setOrigin(0.5, 0)

    const meta = this.scene.add
      .text(
        width / 2,
        height / 2 + 152,
        `${content.catalog.suit} · ${content.catalog.type}`,
        {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#9a9a9a',
        },
      )
      .setOrigin(0.5, 0)

    const body = this.scene.add
      .text(width / 2, height / 2 + 178, content.catalog.description, {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: '#d8d0c0',
        align: 'center',
        wordWrap: { width: panelWidth - 48 },
      })
      .setOrigin(0.5, 0)

    const hint = this.scene.add
      .text(width / 2, height / 2 + panelHeight / 2 - 28, 'click to close', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#7a7a7a',
      })
      .setOrigin(0.5)

    children.push(title, meta, body, hint)
    this.root.add(children)
    this.root.setVisible(true)
    this.visible = true
  }

  hide(): void {
    this.root.removeAll(true)
    this.root.setVisible(false)
    this.visible = false
  }

  isVisible(): boolean {
    return this.visible
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
