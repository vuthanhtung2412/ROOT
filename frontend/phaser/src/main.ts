import '#style.css'
import Phaser from 'phaser'
import { gameConfig } from '#game/config.ts'
import { installHiDpiTextResolution } from '#game/hiDpi.ts'

installHiDpiTextResolution(Phaser)

const game = new Phaser.Game(gameConfig)

declare global {
  interface Window {
    __ROOT_PHASER_GAME__?: Phaser.Game
  }
}

/** Dev/QA hook — resume loaded API games / agent tooling. */
window.__ROOT_PHASER_GAME__ = game
