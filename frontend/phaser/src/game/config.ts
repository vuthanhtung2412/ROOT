import Phaser from 'phaser'
import { BootScene } from '#scenes/BootScene.ts'
import { MenuScene } from '#scenes/MenuScene.ts'
import { GameScene } from '#scenes/GameScene.ts'
import {
  GAME_LOGICAL_HEIGHT,
  GAME_LOGICAL_WIDTH,
  resolveDevicePixelRatio,
} from '#game/hiDpi.ts'
import { CANVAS_FALLBACK_HEX } from '#ui/sceneBackdrop.ts'

const devicePixelRatio = resolveDevicePixelRatio()

/** Desktop-first hot-seat canvas; scenes: Boot → Menu → Game. */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: CANVAS_FALLBACK_HEX,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Dense backing store; zoom keeps CSS size at logical 1280×720.
    width: GAME_LOGICAL_WIDTH * devicePixelRatio,
    height: GAME_LOGICAL_HEIGHT * devicePixelRatio,
    zoom: 1 / devicePixelRatio,
  },
  scene: [BootScene, MenuScene, GameScene],
}
