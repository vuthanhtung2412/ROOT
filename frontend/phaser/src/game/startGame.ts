import Phaser from 'phaser'
import { gameConfig } from '#game/config.ts'
import { installHiDpiTextResolution } from '#game/hiDpi.ts'

installHiDpiTextResolution(Phaser)

/**
 * Create Phaser game mounted under `parent` (DOM id or element).
 * Mirrors phaser-template-react `StartGame(parent)`.
 */
export function startGame(parent: string | HTMLElement): Phaser.Game {
  return new Phaser.Game({ ...gameConfig, parent })
}
