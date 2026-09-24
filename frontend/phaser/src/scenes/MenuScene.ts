import Phaser from 'phaser'
import { ensureAutumnMapLoaded } from '#assets/autumnMapLoader.ts'
import { createPhaserApi } from '#api/client.ts'
import { resolveDefaultApiBaseUrl } from '#api/defaultApiBaseUrl.ts'
import { GameSession, type PlayResult } from '#game/GameSession.ts'
import { applyHiDpiCamera, gameViewSize } from '#game/hiDpi.ts'
import { loadPlayerIdentity } from '#game/playerIdentity.ts'

export type MenuSceneData = {
  session?: GameSession
}

export class MenuScene extends Phaser.Scene {
  private session: GameSession | null = null
  private statusText: Phaser.GameObjects.Text | null = null
  private apiBaseUrlInput: string = ''
  private unsubscribe: (() => void) | null = null
  private enteredGame = false
  private playRequestPending = false

  constructor() {
    super({ key: 'MenuScene' })
  }

  init(data: MenuSceneData): void {
    const defaultApiBaseUrl = resolveDefaultApiBaseUrl()
    this.apiBaseUrlInput = defaultApiBaseUrl
    this.session =
      data.session ??
      new GameSession({
        api: createPhaserApi({ baseUrl: defaultApiBaseUrl }),
        apiBaseUrl: defaultApiBaseUrl,
      })
    this.enteredGame = false
    this.playRequestPending = false
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
    applyHiDpiCamera(this)
    const { width, height } = gameViewSize()

    // Warm map while player uses menu (GameScene skips wait if ready).
    void ensureAutumnMapLoaded(this)

    this.add
      .text(width / 2, height * 0.18, 'ROOT', {
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

    this.statusText = this.add
      .text(width / 2, height * 0.88, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#c44',
        align: 'center',
        wordWrap: { width: width * 0.7 },
      })
      .setOrigin(0.5)

    this.addMenuButton({
      x: width / 2,
      y: height * 0.48,
      label: 'Play',
      onClick: () => {
        void this.handlePlay()
      },
    })
    if (import.meta.env.DEV) {
      this.addMenuButton({
        x: width / 2,
        y: height * 0.6,
        label: 'QA: Continue loaded game',
        onClick: () => {
          void this.handleQaContinue()
        },
        backgroundColor: '#c8d8f0',
      })
    }
  }

  shutdown(): void {
    this.clearLobbyWait()
  }

  private addMenuButton(input: {
    x: number
    y: number
    label: string
    onClick: () => void
    backgroundColor?: string
  }): Phaser.GameObjects.Text {
    const button = this.add
      .text(input.x, input.y, input.label, {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#1a1a1a',
        backgroundColor: input.backgroundColor ?? '#f0e6d3',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    button.on('pointerdown', input.onClick)
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

  private async handlePlay(): Promise<void> {
    if (this.session === null || this.playRequestPending) {
      return
    }
    this.playRequestPending = true
    this.clearLobbyWait()
    const stored = loadPlayerIdentity()
    if (stored !== null && stored.apiBaseUrl !== '') {
      this.apiBaseUrlInput = stored.apiBaseUrl
    } else {
      this.apiBaseUrlInput = resolveDefaultApiBaseUrl()
    }
    this.rebindSessionApi()
    this.setStatus(stored !== null ? 'Checking seat…' : 'Joining…', '#9a9a9a')

    let result: PlayResult | null
    try {
      result = await this.session.play()
    } catch (error: unknown) {
      const message: string =
        error instanceof Error ? error.message : 'Play failed'
      this.setStatus(message, '#c44')
      return
    } finally {
      this.playRequestPending = false
    }
    if (result === null) {
      this.setStatus(this.session.getSnapshot().error ?? 'Play failed', '#c44')
      return
    }

    if (result === 'continued') {
      const snapshot = this.session.getSnapshot()
      if (
        snapshot.state?.status === 'playing' ||
        snapshot.state?.status === 'setup'
      ) {
        this.enterGame()
        return
      }
      this.setStatus('Waiting for second player…', '#9a9a9a')
      this.waitUntilPlaying()
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
