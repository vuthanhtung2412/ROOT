import type Phaser from 'phaser'
import { gameViewSize } from '#game/hiDpi.ts'

export type WinnerOverlayHandlers = {
  onReturnToMenu: () => void
}

/** Full-screen winner banner when status === finished. */
export class WinnerOverlay {
  private readonly root: Phaser.GameObjects.Container
  private readonly message: Phaser.GameObjects.Text
  private readonly returnButton: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, handlers: WinnerOverlayHandlers) {
    const { width, height } = gameViewSize()
    const veil = scene.add
      .rectangle(0, 0, width, height, 0x102010, 0.85)
      .setOrigin(0)

    this.message = scene.add
      .text(width / 2, height / 2 - 28, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '36px',
        color: '#f0e6d3',
        align: 'center',
      })
      .setOrigin(0.5)

    this.returnButton = scene.add
      .text(width / 2, height / 2 + 36, 'Back to menu', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#1a1a1a',
        backgroundColor: '#f0e6d3',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    this.returnButton.on('pointerdown', () => {
      handlers.onReturnToMenu()
    })

    this.root = scene.add
      .container(0, 0, [veil, this.message, this.returnButton])
      .setDepth(320)
      .setVisible(false)
  }

  sync(winnerFaction: string | null): void {
    if (winnerFaction === null) {
      this.root.setVisible(false)
      return
    }
    this.message.setText(`${winnerFaction} wins`)
    this.root.setVisible(true)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
