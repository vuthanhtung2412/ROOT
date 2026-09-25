import Phaser from 'phaser'
import { ensureAutumnMapLoaded } from '#assets/autumnMapLoader.ts'
import { createPhaserApi } from '#api/client.ts'
import { resolveDefaultApiBaseUrl } from '#api/defaultApiBaseUrl.ts'
import { GameSession, type PlayResult } from '#game/GameSession.ts'
import { applyHiDpiCamera } from '#game/hiDpi.ts'
import { setMenuCallbacks } from '#game/hudStore.ts'
import { loadPlayerIdentity } from '#game/playerIdentity.ts'
import {
  hideMenuShell,
  showMenuShell,
  syncMenuPlayPending,
  syncMenuStatus,
} from '#react/MenuOverlay.tsx'

export type MenuSceneData = {
  session?: GameSession
}

export class MenuScene extends Phaser.Scene {
  private session: GameSession | null = null
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

    // Warm map while player uses menu (GameScene skips wait if ready).
    void ensureAutumnMapLoaded(this)

    showMenuShell(import.meta.env.DEV === true)
    setMenuCallbacks({
      onPlay: () => {
        void this.handlePlay()
      },
      onQaContinue: () => {
        void this.handleQaContinue()
      },
    })
  }

  shutdown(): void {
    this.clearLobbyWait()
    hideMenuShell()
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
    syncMenuPlayPending(true)
    this.clearLobbyWait()
    const stored = loadPlayerIdentity()
    if (stored !== null && stored.apiBaseUrl !== '') {
      this.apiBaseUrlInput = stored.apiBaseUrl
    } else {
      this.apiBaseUrlInput = resolveDefaultApiBaseUrl()
    }
    this.rebindSessionApi()
    syncMenuStatus(
      stored !== null ? 'Checking seat…' : 'Joining…',
      '#9a9a9a',
    )

    let result: PlayResult | null
    try {
      result = await this.session.play()
    } catch (error: unknown) {
      const message: string =
        error instanceof Error ? error.message : 'Play failed'
      syncMenuStatus(message, '#c44')
      return
    } finally {
      this.playRequestPending = false
      syncMenuPlayPending(false)
    }
    if (result === null) {
      syncMenuStatus(this.session.getSnapshot().error ?? 'Play failed', '#c44')
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
      syncMenuStatus('Waiting for second player…', '#9a9a9a')
      this.waitUntilPlaying()
      return
    }

    if (result === 'playing') {
      syncMenuStatus('Starting…', '#9a9a9a')
      this.waitUntilPlaying()
      return
    }

    syncMenuStatus('Waiting for second player…', '#9a9a9a')
    this.waitUntilPlaying()
  }

  private waitUntilPlaying(): void {
    if (this.session === null) {
      return
    }
    this.clearLobbyWait()
    this.unsubscribe = this.session.subscribe((snapshot) => {
      if (snapshot.error !== null) {
        syncMenuStatus(snapshot.error, '#c44')
        return
      }
      if (
        snapshot.state?.status === 'playing' ||
        snapshot.state?.status === 'setup'
      ) {
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
    syncMenuStatus('QA loading slot…', '#9a9a9a')
    await this.session.continueQaLoadedGame()
    const snapshot = this.session.getSnapshot()
    if (snapshot.error !== null) {
      syncMenuStatus(snapshot.error, '#c44')
      return
    }
    if (
      snapshot.state === null ||
      (snapshot.state.status !== 'playing' && snapshot.state.status !== 'setup')
    ) {
      syncMenuStatus('No playing game on API — load a snapshot first', '#c44')
      return
    }
    this.enterGame()
  }
}
