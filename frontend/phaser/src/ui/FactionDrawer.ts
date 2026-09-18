import type Phaser from 'phaser'
import type { GameState } from '../api/client.ts'
import { EyrieBoard } from './EyrieBoard.ts'
import { MarquiseBoard } from './MarquiseBoard.ts'

/** Toggleable right drawer for faction boards. */
export class FactionDrawer {
  private readonly root: Phaser.GameObjects.Container
  private readonly toggle: Phaser.GameObjects.Text
  private readonly marquiseBoard: MarquiseBoard
  private readonly eyrieBoard: EyrieBoard
  private readonly panelWidth = 220
  private open = false
  private readonly closedX: number
  private readonly openX: number

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale
    this.closedX = width
    this.openX = width - this.panelWidth

    const panel = scene.add
      .rectangle(0, 0, this.panelWidth, height - 40, 0x111111, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xf0e6d3, 0.4)

    this.marquiseBoard = new MarquiseBoard(scene, 12, 48)
    this.eyrieBoard = new EyrieBoard(scene, 12, 160)

    this.root = scene.add
      .container(this.closedX, 20, [
        panel,
        this.marquiseBoard.gameObject,
        this.eyrieBoard.gameObject,
      ])
      .setDepth(135)
      .setVisible(false)

    this.toggle = scene.add
      .text(width - 24, height / 2, '◀', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#1a1a1a',
        backgroundColor: '#f0e6d3',
        padding: { x: 6, y: 10 },
      })
      .setOrigin(1, 0.5)
      .setDepth(140)
      .setInteractive({ useHandCursor: true })

    this.toggle.on('pointerdown', () => {
      this.open = !this.open
      this.root.setVisible(this.open)
      this.root.setX(this.open ? this.openX : this.closedX)
      this.toggle.setText(this.open ? '▶' : '◀')
    })
  }

  sync(state: GameState): void {
    this.marquiseBoard.sync(state)
    this.eyrieBoard.sync(state)
  }

  destroy(): void {
    this.toggle.destroy()
    this.root.destroy(true)
  }
}
