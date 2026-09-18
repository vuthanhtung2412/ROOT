import type Phaser from 'phaser'

export type HandoffOverlayHandlers = {
  onContinue: () => void
}

/** Hot-seat privacy curtain — hide hand until next player ready. */
export class HandoffOverlay {
  private readonly root: Phaser.GameObjects.Container
  private readonly message: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, handlers: HandoffOverlayHandlers) {
    const { width, height } = scene.scale
    const veil = scene.add
      .rectangle(0, 0, width, height, 0x0a0a0a, 0.92)
      .setOrigin(0)
      .setInteractive()

    this.message = scene.add
      .text(width / 2, height / 2 - 40, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#f0e6d3',
        align: 'center',
      })
      .setOrigin(0.5)

    const button = scene.add
      .text(width / 2, height / 2 + 40, 'Ready', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1a1a1a',
        backgroundColor: '#f0e6d3',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    button.on('pointerdown', () => {
      handlers.onContinue()
    })

    this.root = scene.add
      .container(0, 0, [veil, this.message, button])
      .setDepth(300)
      .setVisible(false)
  }

  show(factionName: string): void {
    this.message.setText(`Pass device to ${factionName}`)
    this.root.setVisible(true)
  }

  hide(): void {
    this.root.setVisible(false)
  }

  get visible(): boolean {
    return this.root.visible
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
