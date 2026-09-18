import type Phaser from 'phaser'
import { GameLog } from './GameLog.ts'

/** Bottom-left game log panel. */
export class GameDrawer {
  private readonly root: Phaser.GameObjects.Container
  private readonly gameLog: GameLog

  constructor(scene: Phaser.Scene) {
    const { height } = scene.scale
    this.gameLog = new GameLog(scene, 0, 0)
    this.root = scene.add
      .container(12, height - 220, [this.gameLog.gameObject])
      .setDepth(112)
  }

  sync(log: readonly unknown[]): void {
    this.gameLog.sync(log)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
