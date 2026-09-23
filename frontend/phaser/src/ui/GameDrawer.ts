import type Phaser from 'phaser'
import { gameViewSize } from '#game/hiDpi.ts'

export type GameDrawerHandlers = {
  onEndGame: () => void
}

/** End game control. Undo removed — unsafe in multiplayer. */
export class GameDrawer {
  private readonly root: Phaser.GameObjects.Container
  private readonly endGameButton: Phaser.GameObjects.Text
  private endGameArmed = false

  constructor(scene: Phaser.Scene, handlers: GameDrawerHandlers) {
    const { height } = gameViewSize()
    this.endGameButton = scene.add
      .text(0, 0, 'End game', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#1a1a1a',
        backgroundColor: '#c8a8a8',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })

    this.endGameButton.on('pointerdown', () => {
      if (!this.endGameArmed) {
        this.endGameArmed = true
        this.endGameButton.setText('Confirm end?')
        this.endGameButton.setBackgroundColor('#e07070')
        return
      }
      this.endGameArmed = false
      this.endGameButton.setText('End game')
      this.endGameButton.setBackgroundColor('#c8a8a8')
      handlers.onEndGame()
    })

    this.root = scene.add
      .container(12, height - 90, [this.endGameButton])
      .setDepth(112)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
