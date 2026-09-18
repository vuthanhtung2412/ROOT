import type Phaser from 'phaser'
import { GameLog } from './GameLog.ts'

export type GameDrawerHandlers = {
  onUndo: () => void
}

/** Log panel + undo control. */
export class GameDrawer {
  private readonly root: Phaser.GameObjects.Container
  private readonly gameLog: GameLog
  private readonly undoButton: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, handlers: GameDrawerHandlers) {
    const { height } = scene.scale
    this.gameLog = new GameLog(scene, 0, 0)
    this.undoButton = scene.add
      .text(0, 170, 'Undo', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#1a1a1a',
        backgroundColor: '#d8c8a8',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })

    this.undoButton.on('pointerdown', () => {
      handlers.onUndo()
    })

    this.root = scene.add
      .container(12, height - 260, [this.gameLog.gameObject, this.undoButton])
      .setDepth(112)
  }

  sync(log: readonly unknown[], canUndo: boolean): void {
    this.gameLog.sync(log)
    this.undoButton.setAlpha(canUndo ? 1 : 0.4)
    if (canUndo) {
      this.undoButton.setInteractive({ useHandCursor: true })
    } else {
      this.undoButton.disableInteractive()
    }
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
