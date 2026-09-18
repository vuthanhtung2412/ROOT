import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene.ts'

/** Desktop-first hot-seat canvas; scenes: Boot → Menu → Game (later commits). */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1a1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [BootScene],
}
