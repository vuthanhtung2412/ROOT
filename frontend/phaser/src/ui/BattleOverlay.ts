import type Phaser from 'phaser'

/** Blocking banner for battle pending stages (§4.3). */
export class BattleOverlay {
  private readonly root: Phaser.GameObjects.Container
  private readonly label: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale
    const veil = scene.add
      .rectangle(0, 0, width, height, 0x1a2030, 0.4)
      .setOrigin(0)
    this.label = scene.add
      .text(width / 2, 64, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: '#f0e6d3',
        backgroundColor: '#2a3a5acc',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
    this.root = scene.add.container(0, 0, [veil, this.label]).setDepth(201)
    this.root.setVisible(false)
  }

  sync(visible: boolean, message: string): void {
    this.root.setVisible(visible)
    this.label.setText(message)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
