import type Phaser from 'phaser'
import { gameViewSize } from '#game/hiDpi.ts'

export type GameDrawerHandlers = {
  onEndGame: () => void
  onOpenDiscardPile: () => void
}

const DRAWER_BOTTOM_MARGIN = 90
const DRAWER_SIDE_MARGIN = 12

/** Discard pile browse (right) + End game (left). */
export class GameDrawer {
  private readonly discardButton: Phaser.GameObjects.Text
  private readonly endGameButton: Phaser.GameObjects.Text
  private endGameArmed = false

  constructor(scene: Phaser.Scene, handlers: GameDrawerHandlers) {
    const { width, height } = gameViewSize()
    const buttonY = height - DRAWER_BOTTOM_MARGIN

    this.discardButton = scene.add
      .text(width - DRAWER_SIDE_MARGIN, buttonY, 'Discard', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#1a1a1a',
        backgroundColor: '#c8d0e0',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setDepth(112)
      .setInteractive({ useHandCursor: true })

    this.discardButton.on('pointerdown', () => {
      handlers.onOpenDiscardPile()
    })

    this.endGameButton = scene.add
      .text(DRAWER_SIDE_MARGIN, buttonY, 'End game', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#1a1a1a',
        backgroundColor: '#c8a8a8',
        padding: { x: 10, y: 6 },
      })
      .setDepth(112)
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
  }

  sync(discardCount: number): void {
    this.discardButton.setText(`Discard (${String(discardCount)})`)
  }

  destroy(): void {
    this.discardButton.destroy()
    this.endGameButton.destroy()
  }
}
