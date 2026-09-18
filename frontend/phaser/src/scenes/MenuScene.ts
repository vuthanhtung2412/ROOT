import Phaser from 'phaser'
import { createPhaserApi } from '../api/client.ts'
import { GameSession } from '../game/GameSession.ts'

export type MenuSceneData = {
  session?: GameSession
}

const GP2_FACTIONS: string[] = ['marquise', 'eyrie']
const GP2_PLAYER_IDS: string[] = ['marquise', 'eyrie']

export class MenuScene extends Phaser.Scene {
  private session: GameSession | null = null
  private statusText: Phaser.GameObjects.Text | null = null

  constructor() {
    super({ key: 'MenuScene' })
  }

  init(data: MenuSceneData): void {
    this.session =
      data.session ??
      new GameSession(createPhaserApi({ baseUrl: '' }))
  }

  create(): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height * 0.28, 'Root', {
        fontFamily: 'Georgia, serif',
        fontSize: '56px',
        color: '#f0e6d3',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height * 0.38, 'Marquise vs Eyrie · local hot-seat', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9a9a9a',
      })
      .setOrigin(0.5)

    this.statusText = this.add
      .text(width / 2, height * 0.72, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#c44',
        align: 'center',
        wordWrap: { width: width * 0.7 },
      })
      .setOrigin(0.5)

    const startButton = this.add
      .text(width / 2, height * 0.55, 'New GP2 game', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#1a1a1a',
        backgroundColor: '#f0e6d3',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    startButton.on('pointerdown', () => {
      void this.handleStartGame(startButton)
    })
  }

  private async handleStartGame(
    startButton: Phaser.GameObjects.Text,
  ): Promise<void> {
    if (this.session === null) {
      return
    }
    startButton.disableInteractive()
    this.setStatus('Creating game…', '#9a9a9a')

    await this.session.startHotSeatGame({
      factions: GP2_FACTIONS,
      playerIds: GP2_PLAYER_IDS,
    })

    const snapshot = this.session.getSnapshot()
    if (snapshot.error !== null) {
      this.setStatus(snapshot.error, '#c44')
      startButton.setInteractive({ useHandCursor: true })
      return
    }

    this.scene.start('GameScene', { session: this.session })
  }

  private setStatus(message: string, color: string): void {
    if (this.statusText === null) {
      return
    }
    this.statusText.setColor(color)
    this.statusText.setText(message)
  }
}
