import type Phaser from 'phaser'

/** Full-screen winner banner when status === finished. */
export class WinnerOverlay {
  private readonly root: Phaser.GameObjects.Container
  private readonly message: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale
    const veil = scene.add
      .rectangle(0, 0, width, height, 0x102010, 0.85)
      .setOrigin(0)

    this.message = scene.add
      .text(width / 2, height / 2, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '36px',
        color: '#f0e6d3',
        align: 'center',
      })
      .setOrigin(0.5)

    this.root = scene.add
      .container(0, 0, [veil, this.message])
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
