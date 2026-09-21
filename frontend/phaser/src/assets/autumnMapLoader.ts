import type Phaser from 'phaser'
import { queueAutumnMapImage } from './gameAssets.ts'

/**
 * Ensure autumn map texture exists (load if missing).
 * Resolves immediately when already cached.
 */
export function ensureAutumnMapLoaded(scene: Phaser.Scene): Promise<void> {
  const queued = queueAutumnMapImage(scene.load, (key) =>
    scene.textures.exists(key),
  )
  if (!queued) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    scene.load.once('complete', () => {
      resolve()
    })
    if (!scene.load.isLoading()) {
      scene.load.start()
    }
  })
}
