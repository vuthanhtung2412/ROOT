import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  create(): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height / 2 - 40, 'Root', {
        fontFamily: 'Georgia, serif',
        fontSize: '48px',
        color: '#f0e6d3',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 + 8, 'Phaser boot ok', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9a9a9a',
      })
      .setOrigin(0.5)

    const helloButton = this.add
      .text(width / 2, height / 2 + 80, 'Hello world', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1a1a1a',
        backgroundColor: '#f0e6d3',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    helloButton.on('pointerdown', () => {
      console.log('Hello world')
    })
  }
}
