import Phaser from 'phaser'
import { createPhaserApi } from '../api/client.ts'
import { GameSession } from '../game/GameSession.ts'
import { loadPlayerIdentity } from '../game/playerIdentity.ts'

export type MenuSceneData = {
  session?: GameSession
}

const GP2_FACTIONS: string[] = ['marquise', 'eyrie']
const DEFAULT_HOST_PLAYER_ID = 'marquise'
const DEFAULT_GUEST_PLAYER_ID = 'eyrie'

export class MenuScene extends Phaser.Scene {
  private session: GameSession | null = null
  private statusText: Phaser.GameObjects.Text | null = null
  private apiBaseUrlInput: string = ''

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
  }

  create(): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height * 0.14, 'Root', {
        fontFamily: 'Georgia, serif',
        fontSize: '56px',
        color: '#f0e6d3',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height * 0.22, 'Marquise vs Eyrie · two machines', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9a9a9a',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height * 0.3, 'API base (empty = Vite proxy)', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#7a7a7a',
      })
      .setOrigin(0.5)

    const apiField = this.add
      .text(width / 2, height * 0.34, 'http://HOST:3000', {
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

    this.addMenuButton(width / 2, height * 0.44, 'Host GP2', () => {
      void this.handleHost()
    })
    this.addMenuButton(width / 2, height * 0.54, 'Join GP2', () => {
      void this.handleJoin()
    })
    this.addMenuButton(width / 2, height * 0.64, 'Continue', () => {
      void this.handleContinue()
    })
    this.addMenuButton(
      width / 2,
      height * 0.74,
      'QA: Continue loaded game',
      () => {
        void this.handleQaContinue()
      },
      '#c8d8f0',
    )
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

  private async handleHost(): Promise<void> {
    if (this.session === null) {
      return
    }
    this.rebindSessionApi()
    this.setStatus('Hosting lobby…', '#9a9a9a')
    await this.session.hostGame({
      playerId: DEFAULT_HOST_PLAYER_ID,
      factions: GP2_FACTIONS,
    })
    const snapshot = this.session.getSnapshot()
    if (snapshot.error !== null) {
      this.setStatus(snapshot.error, '#c44')
      return
    }
    this.setStatus('Lobby ready — waiting / Start when 2 players', '#9a9a9a')
    await this.maybeStartAndEnter()
  }

  private async handleJoin(): Promise<void> {
    if (this.session === null) {
      return
    }
    this.rebindSessionApi()
    this.setStatus('Joining…', '#9a9a9a')
    await this.session.joinGame({ playerId: DEFAULT_GUEST_PLAYER_ID })
    const snapshot = this.session.getSnapshot()
    if (snapshot.error !== null) {
      this.setStatus(snapshot.error, '#c44')
      return
    }
    this.setStatus('Joined — Start when ready', '#9a9a9a')
    await this.maybeStartAndEnter()
  }

  private async maybeStartAndEnter(): Promise<void> {
    if (this.session === null) {
      return
    }
    const shouldStart = window.confirm(
      'Start game now? (Cancel to wait — use Continue later)',
    )
    if (!shouldStart) {
      return
    }
    await this.session.startLobby()
    const snapshot = this.session.getSnapshot()
    if (snapshot.error !== null) {
      this.setStatus(snapshot.error, '#c44')
      return
    }
    this.scene.start('GameScene', { session: this.session })
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
    this.scene.start('GameScene', { session: this.session })
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
    if (snapshot.state === null || snapshot.state.status !== 'playing') {
      this.setStatus('No playing game on API — load a snapshot first', '#c44')
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
