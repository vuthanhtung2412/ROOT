import Phaser from 'phaser'
import { preloadCoreGameAssets } from '#assets/gameAssets.ts'
import { applyHiDpiCamera } from '#game/hiDpi.ts'
import {
  clearBootLoading,
  syncBootLoading,
} from '#react/BootOverlay.tsx'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    applyHiDpiCamera(this)
    syncBootLoading(0)

    this.load.on('progress', (value: number) => {
      syncBootLoading(value)
    })

    this.load.on('complete', () => {
      clearBootLoading()
    })

    preloadCoreGameAssets(this.load)
  }

  create(): void {
    clearBootLoading()
    this.scene.start('MenuScene')
  }
}
