import type Phaser from 'phaser'
import type { ComposerPrompt } from '../game/ActionComposer.ts'

export type SelectionPromptHandlers = {
  onConfirm: () => void
  onCancel: () => void
}

/** Bottom-center prompt while composing a multi-step action. */
export class SelectionPrompt {
  private readonly root: Phaser.GameObjects.Container
  private readonly message: Phaser.GameObjects.Text
  private readonly confirmButton: Phaser.GameObjects.Text
  private readonly cancelButton: Phaser.GameObjects.Text
  private handlers: SelectionPromptHandlers

  constructor(scene: Phaser.Scene, handlers: SelectionPromptHandlers) {
    this.handlers = handlers
    const { width, height } = scene.scale

    this.message = scene.add
      .text(0, -28, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f0e6d3',
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5)

    this.confirmButton = scene.add
      .text(-60, 16, 'Confirm', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#1a1a1a',
        backgroundColor: '#a8d8a8',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    this.cancelButton = scene.add
      .text(60, 16, 'Cancel', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#1a1a1a',
        backgroundColor: '#d8a8a8',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    this.confirmButton.on('pointerdown', () => {
      this.handlers.onConfirm()
    })
    this.cancelButton.on('pointerdown', () => {
      this.handlers.onCancel()
    })

    this.root = scene.add
      .container(width * 0.38, height - 160, [
        this.message,
        this.confirmButton,
        this.cancelButton,
      ])
      .setDepth(130)
      .setVisible(false)
  }

  setHandlers(handlers: SelectionPromptHandlers): void {
    this.handlers = handlers
  }

  sync(prompt: ComposerPrompt | null): void {
    if (prompt === null) {
      this.root.setVisible(false)
      return
    }
    this.message.setText(prompt.message)
    this.confirmButton.setVisible(prompt.canConfirm)
    this.cancelButton.setVisible(prompt.canCancel)
    this.root.setVisible(true)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
