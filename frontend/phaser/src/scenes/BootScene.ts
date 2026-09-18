import Phaser from 'phaser'
import { preloadCoreGameAssets } from '../assets/gameAssets.ts'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    const { width, height } = this.scale

    const progressBar = this.add.graphics()
    const progressBox = this.add.graphics()
    progressBox.fillStyle(0x222222, 0.8)
    progressBox.fillRect(width / 2 - 160, height / 2 - 16, 320, 32)

    const loadingText = this.add
      .text(width / 2, height / 2 - 48, 'Loading…', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#f0e6d3',
      })
      .setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      progressBar.clear()
      progressBar.fillStyle(0xf0e6d3, 1)
      progressBar.fillRect(width / 2 - 152, height / 2 - 8, 304 * value, 16)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
      loadingText.destroy()
    })

    preloadCoreGameAssets(this.load)
  }

  create(): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height / 2 - 24, 'Root', {
        fontFamily: 'Georgia, serif',
        fontSize: '48px',
        color: '#f0e6d3',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 + 24, 'Assets ready', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9a9a9a',
      })
      .setOrigin(0.5)
  }
}
