import Phaser from 'phaser'
import { createPhaserApi } from '../api/client.ts'
import { GameSession } from '../game/GameSession.ts'
import { loadPlayerIdentity } from '../game/playerIdentity.ts'

export type MenuSceneData = {
  session?: GameSession
}

export class MenuScene extends Phaser.Scene {
  private session: GameSession | null = null
  private statusText: Phaser.GameObjects.Text | null = null
  private apiBaseUrlInput: string = ''
  private unsubscribe: (() => void) | null = null
  private enteredGame = false

  constructor() {
    super({ key: 'MenuScene' })
  }

  init(data: MenuSceneData): void {
    this.session =
      data.session ??
      new GameSession({
        api: createPhaserApi({ baseUrl: '' }),
        apiBaseUrl: '',
      })
    this.enteredGame = false
  }

  create(): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height * 0.18, 'Root', {
        fontFamily: 'Georgia, serif',
        fontSize: '56px',
        color: '#f0e6d3',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height * 0.28, 'Marquise vs Eyrie', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9a9a9a',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height * 0.36, 'API base (empty = Vite proxy)', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#7a7a7a',
      })
      .setOrigin(0.5)

    const apiField = this.add
      .text(width / 2, height * 0.4, '(same-origin proxy)', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#1a1a1a',
        backgroundColor: '#e8e0d0',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    apiField.on('pointerdown', () => {
      const entered = window.prompt(
        'API base URL (empty for same-origin proxy)',
        this.apiBaseUrlInput,
      )
      if (entered === null) {
        return
      }
      this.apiBaseUrlInput = entered.trim()
      apiField.setText(
        this.apiBaseUrlInput === ''
          ? '(same-origin proxy)'
          : this.apiBaseUrlInput,
      )
      this.rebindSessionApi()
    })

    this.statusText = this.add
      .text(width / 2, height * 0.88, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#c44',
        align: 'center',
        wordWrap: { width: width * 0.7 },
      })
      .setOrigin(0.5)

    this.addMenuButton(width / 2, height * 0.52, 'Join game', () => {
      void this.handleJoinMatch()
    })
    this.addMenuButton(width / 2, height * 0.62, 'Continue', () => {
      void this.handleContinue()
    })
    this.addMenuButton(
      width / 2,
      height * 0.72,
      'QA: Continue loaded game',
      () => {
        void this.handleQaContinue()
      },
      '#c8d8f0',
    )
  }

  shutdown(): void {
    this.clearLobbyWait()
  }

  private addMenuButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    backgroundColor = '#f0e6d3',
  ): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#1a1a1a',
        backgroundColor,
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    button.on('pointerdown', onClick)
    return button
  }

  private rebindSessionApi(): void {
    if (this.session === null) {
      return
    }
    this.session.rebindApi(
      createPhaserApi({ baseUrl: this.apiBaseUrlInput }),
      this.apiBaseUrlInput,
    )
  }

  private async handleJoinMatch(): Promise<void> {
    if (this.session === null) {
      return
    }
    this.clearLobbyWait()
    this.rebindSessionApi()
    this.setStatus('Joining…', '#9a9a9a')

    const result = await this.session.joinMatch()
    if (result === null) {
      this.setStatus(this.session.getSnapshot().error ?? 'Join failed', '#c44')
      return
    }

    if (result === 'playing') {
      this.setStatus('Starting…', '#9a9a9a')
      this.waitUntilPlaying()
      return
    }

    this.setStatus('Waiting for second player…', '#9a9a9a')
    this.waitUntilPlaying()
  }

  private waitUntilPlaying(): void {
    if (this.session === null) {
      return
    }
    this.clearLobbyWait()
    this.unsubscribe = this.session.subscribe((snapshot) => {
      if (snapshot.error !== null) {
        this.setStatus(snapshot.error, '#c44')
        return
      }
      if (snapshot.state?.status === 'playing' || snapshot.state?.status === 'setup') {
        this.enterGame()
      }
    })
  }

  private enterGame(): void {
    if (this.enteredGame || this.session === null) {
      return
    }
    this.enteredGame = true
    this.clearLobbyWait()
    this.scene.start('GameScene', { session: this.session })
  }

  private clearLobbyWait(): void {
    if (this.unsubscribe !== null) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  private async handleContinue(): Promise<void> {
    if (this.session === null) {
      return
    }
    const stored = loadPlayerIdentity()
    if (stored === null) {
      this.setStatus('No stored player identity', '#c44')
      return
    }
    this.apiBaseUrlInput = stored.apiBaseUrl
    this.rebindSessionApi()
    this.setStatus('Reconnecting…', '#9a9a9a')
    await this.session.continueWithStoredIdentity(stored)
    const snapshot = this.session.getSnapshot()
    if (snapshot.error !== null) {
      this.setStatus(snapshot.error, '#c44')
      return
    }
    if (snapshot.state?.status === 'playing' || snapshot.state?.status === 'setup') {
      this.enterGame()
      return
    }
    this.setStatus('Waiting for second player…', '#9a9a9a')
    this.waitUntilPlaying()
  }

  private async handleQaContinue(): Promise<void> {
    if (this.session === null) {
      return
    }
    this.rebindSessionApi()
    this.setStatus('QA loading slot…', '#9a9a9a')
    await this.session.continueQaLoadedGame()
    const snapshot = this.session.getSnapshot()
    if (snapshot.error !== null) {
      this.setStatus(snapshot.error, '#c44')
      return
    }
    if (
      snapshot.state === null ||
      (snapshot.state.status !== 'playing' && snapshot.state.status !== 'setup')
    ) {
      this.setStatus('No playing game on API — load a snapshot first', '#c44')
      return
    }
    this.enterGame()
  }

  private setStatus(message: string, color: string): void {
    if (this.statusText === null) {
      return
    }
    this.statusText.setColor(color)
    this.statusText.setText(message)
  }
}
