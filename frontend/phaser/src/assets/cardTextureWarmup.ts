import type Phaser from 'phaser'
import { queueMissingCardImages } from '#assets/gameAssets.ts'

export type CardTexturesReadyHandler = () => void

/**
 * Loads only the card faces needed for the current hand (or detail),
 * so GameScene can paint the board without waiting on the full catalog.
 */
export class CardTextureWarmup {
  private readonly scene: Phaser.Scene
  private readonly pendingKeys = new Set<string>()
  private waitingForComplete = false
  private onReady: CardTexturesReadyHandler | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  setOnReady(handler: CardTexturesReadyHandler | null): void {
    this.onReady = handler
  }

  ensure(defIds: readonly string[]): void {
    const { queuedCount, newlyQueuedKeys } = queueMissingCardImages(
      this.scene.load,
      (key) => this.scene.textures.exists(key),
      defIds,
      this.pendingKeys,
    )
    for (const key of newlyQueuedKeys) {
      this.pendingKeys.add(key)
    }
    if (queuedCount === 0) {
      return
    }
    if (!this.waitingForComplete) {
      this.waitingForComplete = true
      this.scene.load.once('complete', () => {
        this.waitingForComplete = false
        this.pendingKeys.clear()
        this.onReady?.()
      })
    }
    if (!this.scene.load.isLoading()) {
      this.scene.load.start()
    }
  }
}
