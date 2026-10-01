import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import { createFrontendApi, type GameState } from '#api/client.ts'
import { resolveDefaultApiBaseUrl } from '#api/defaultApiBaseUrl.ts'
import {
  autumnMapPublicPath,
  CORE_IMAGE_ASSETS,
} from '#assets/gameAssets.ts'
import { GameSession } from '#game/GameSession.ts'
import {
  getHudSnapshot,
  setMenuCallbacks,
  subscribeHud,
  type MenuLobbyHudState,
} from '#game/hudStore.ts'
import { ReactGameController } from '#game/ReactGameController.ts'
import {
  clearBootLoading,
  syncBootLoading,
} from '#react/BootOverlay.tsx'
import { GameScreen } from '#react/GameScreen.tsx'
import {
  showMenuShell,
  syncMenuLobby,
  syncMenuPlayPending,
  syncMenuStatus,
} from '#react/MenuOverlay.tsx'
import { ReactHud } from '#react/ReactHud.tsx'
import { useViewportLayoutMode } from '#react/useViewportLayoutMode.ts'

/** Lobby rows for the menu: one per faction seat, filled in join order. */
function buildMenuLobby(
  state: GameState,
  localSeat: number | null,
  isHost: boolean,
): MenuLobbyHudState {
  const joinedCount: number = state.players.length
  return {
    seats: state.factions.map((faction, seat) => ({
      faction,
      occupied: seat < joinedCount,
      isLocalPlayer: seat === localSeat,
    })),
    isHost,
    canStart: isHost && joinedCount === state.factions.length,
  }
}

function prefetchImage(path: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      resolve()
    }
    image.onerror = () => {
      resolve()
    }
    image.src = path.startsWith('/') ? path : `/${path}`
  })
}

async function prefetchBootAssets(
  onProgress: (value: number) => void,
): Promise<void> {
  const paths = [
    ...CORE_IMAGE_ASSETS.map((asset) => asset.path),
    autumnMapPublicPath(),
  ]
  let loaded = 0
  const total = Math.max(paths.length, 1)
  await Promise.all(
    paths.map(async (path) => {
      await prefetchImage(path)
      loaded += 1
      onProgress(loaded / total)
    }),
  )
}

export function App(): JSX.Element {
  const shell = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().shell,
    () => getHudSnapshot().shell,
  )
  const sessionRef = useRef<GameSession | null>(null)
  const controllerRef = useRef<ReactGameController | null>(null)
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(
    resolveDefaultApiBaseUrl(),
  )
  const playPendingRef = useRef(false)
  const lobbyUnsubscribeRef = useRef<(() => void) | null>(null)
  const handleStartPartyRef = useRef<(factions: string[]) => void>(() => undefined)
  const handleQaContinueRef = useRef<() => void>(() => undefined)
  const handleHostOnlineRef = useRef<(factions: string[]) => void>(
    () => undefined,
  )
  const handleJoinOnlineRef = useRef<() => void>(() => undefined)
  const handleStartOnlineRef = useRef<() => void>(() => undefined)
  const resumeOnlineGameRef = useRef<() => Promise<void>>(() =>
    Promise.resolve(),
  )

  if (controllerRef.current === null) {
    controllerRef.current = new ReactGameController()
  }
  const controller = controllerRef.current

  const board = useSyncExternalStore(
    (listener) => controller.subscribeBoard(listener),
    () => controller.getBoardSnapshot(),
    () => controller.getBoardSnapshot(),
  )

  /** Join id for the API header; the session owns it once a seat is taken. */
  const readRequestPlayerId = useCallback(
    (): string | null => sessionRef.current?.getRequestPlayerId() ?? null,
    [],
  )

  const ensureSession = useCallback((): GameSession => {
    if (sessionRef.current !== null) {
      return sessionRef.current
    }
    const session = new GameSession({
      api: createFrontendApi({
        baseUrl: apiBaseUrlInput,
        playerId: readRequestPlayerId,
      }),
      apiBaseUrl: apiBaseUrlInput,
    })
    sessionRef.current = session
    return session
  }, [apiBaseUrlInput, readRequestPlayerId])

  const clearLobbyWait = useCallback((): void => {
    if (lobbyUnsubscribeRef.current !== null) {
      lobbyUnsubscribeRef.current()
      lobbyUnsubscribeRef.current = null
    }
  }, [])

  /** Menu shell with live buttons (leaving a game resets HUD callbacks). */
  const showMenu = useCallback((): void => {
    showMenuShell(import.meta.env.DEV === true)
    setMenuCallbacks({
      onStartParty: (factions) => {
        handleStartPartyRef.current(factions)
      },
      onQaContinue: () => {
        handleQaContinueRef.current()
      },
      onHostOnline: (factions) => {
        handleHostOnlineRef.current(factions)
      },
      onJoinOnline: () => {
        handleJoinOnlineRef.current()
      },
      onStartOnline: () => {
        handleStartOnlineRef.current()
      },
    })
  }, [])

  const enterGame = useCallback((): void => {
    clearLobbyWait()
    const session = ensureSession()
    void controller.start(session, () => {
      showMenu()
    })
  }, [clearLobbyWait, controller, ensureSession, showMenu])

  const rebindSessionApi = useCallback(
    (baseUrl: string): void => {
      const session = ensureSession()
      session.rebindApi(
        createFrontendApi({ baseUrl, playerId: readRequestPlayerId }),
        baseUrl,
      )
    },
    [ensureSession, readRequestPlayerId],
  )

  /**
   * Online: show the lobby while seats fill, enter the game once the host
   * starts, and fall back to the menu if the game is removed.
   */
  const watchOnlineLobby = useCallback((): void => {
    clearLobbyWait()
    const session = ensureSession()
    lobbyUnsubscribeRef.current = session.subscribe((snapshot) => {
      const state = snapshot.state
      if (state === null) {
        clearLobbyWait()
        syncMenuLobby(null)
        syncMenuStatus('The online game was closed', '#c44')
        return
      }
      if (state.status === 'waiting') {
        syncMenuLobby(
          buildMenuLobby(state, session.getLocalSeat(), session.isOnlineHost()),
        )
        return
      }
      if (state.status === 'setup' || state.status === 'playing') {
        enterGame()
      }
    })
  }, [clearLobbyWait, ensureSession, enterGame])

  const runOnlineLobbyAction = useCallback(
    async (
      pendingMessage: string,
      action: (session: GameSession) => Promise<boolean>,
    ): Promise<void> => {
      if (playPendingRef.current) {
        return
      }
      playPendingRef.current = true
      syncMenuPlayPending(true)
      const nextBase = resolveDefaultApiBaseUrl()
      setApiBaseUrlInput(nextBase)
      rebindSessionApi(nextBase)
      syncMenuStatus(pendingMessage, '#9a9a9a')
      const session = ensureSession()
      const succeeded = await action(session)
      playPendingRef.current = false
      syncMenuPlayPending(false)
      if (!succeeded) {
        syncMenuStatus(session.getSnapshot().error ?? 'Failed', '#c44')
        return
      }
      syncMenuStatus('', '#9a9a9a')
      watchOnlineLobby()
    },
    [ensureSession, rebindSessionApi, watchOnlineLobby],
  )

  const handleHostOnline = useCallback(
    (factions: string[]): Promise<void> =>
      runOnlineLobbyAction('Creating online lobby…', (session) =>
        session.hostOnlineGame(factions),
      ),
    [runOnlineLobbyAction],
  )

  const handleJoinOnline = useCallback(
    (): Promise<void> =>
      runOnlineLobbyAction('Joining online lobby…', (session) =>
        session.joinOnlineGame(),
      ),
    [runOnlineLobbyAction],
  )

  const handleStartOnline = useCallback(async (): Promise<void> => {
    const session = ensureSession()
    await session.startOnlineGame()
    const error = session.getSnapshot().error
    if (error !== null) {
      syncMenuStatus(error, '#c44')
    }
  }, [ensureSession])

  const handleStartParty = useCallback(
    async (factions: string[]): Promise<void> => {
      if (playPendingRef.current) {
        return
      }
      playPendingRef.current = true
      syncMenuPlayPending(true)
      clearLobbyWait()
      const nextBase = resolveDefaultApiBaseUrl()
      setApiBaseUrlInput(nextBase)
      rebindSessionApi(nextBase)
      syncMenuStatus('Starting…', '#9a9a9a')

      const session = ensureSession()
      let started = false
      try {
        started = await session.startLocalParty(factions)
      } catch (error: unknown) {
        const message: string =
          error instanceof Error ? error.message : 'Start failed'
        syncMenuStatus(message, '#c44')
        playPendingRef.current = false
        syncMenuPlayPending(false)
        return
      }
      playPendingRef.current = false
      syncMenuPlayPending(false)

      if (!started) {
        syncMenuStatus(session.getSnapshot().error ?? 'Start failed', '#c44')
        return
      }

      const snapshot = session.getSnapshot()
      if (
        snapshot.state?.status === 'playing' ||
        snapshot.state?.status === 'setup'
      ) {
        enterGame()
        return
      }
      syncMenuStatus('Game not ready', '#c44')
    },
    [clearLobbyWait, ensureSession, enterGame, rebindSessionApi],
  )

  const handleQaContinue = useCallback(async (): Promise<void> => {
    const session = ensureSession()
    rebindSessionApi(apiBaseUrlInput)
    syncMenuStatus('QA loading slot…', '#9a9a9a')
    await session.continueQaLoadedGame()
    const snapshot = session.getSnapshot()
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
    enterGame()
  }, [apiBaseUrlInput, ensureSession, enterGame, rebindSessionApi])

  handleStartPartyRef.current = (factions: string[]) => {
    void handleStartParty(factions)
  }
  handleQaContinueRef.current = () => {
    void handleQaContinue()
  }
  handleHostOnlineRef.current = (factions: string[]) => {
    void handleHostOnline(factions)
  }
  handleJoinOnlineRef.current = () => {
    void handleJoinOnline()
  }
  handleStartOnlineRef.current = () => {
    void handleStartOnline()
  }
  resumeOnlineGameRef.current = async (): Promise<void> => {
    const session = ensureSession()
    if (await session.resumeOnlineGame()) {
      watchOnlineLobby()
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      syncBootLoading(0)
      await prefetchBootAssets((value) => {
        if (!cancelled) {
          syncBootLoading(value)
        }
      })
      if (cancelled) {
        return
      }
      clearBootLoading()
      showMenu()
      // Reload in an online game: take the stored seat back.
      await resumeOnlineGameRef.current()
    })()
    return () => {
      cancelled = true
      clearLobbyWait()
      controller.stop()
    }
  }, [clearLobbyWait, controller, showMenu])

  const gameVisible = shell === 'game'
  const layoutMode = useViewportLayoutMode()

  const gameScreen = useMemo(() => {
    if (!gameVisible) {
      return null
    }
    return (
      <GameScreen
        layout={board.layout}
        layoutMode={layoutMode}
        clearings={board.clearings}
        factions={board.factions}
        forestPawns={board.forestPawns}
        highlightedClearingIds={board.highlightedClearingIds}
        highlightedForestIndexes={board.highlightedForestIndexes}
        onClearingSelected={(clearingId) => {
          controller.selectClearing(clearingId)
        }}
        onForestSelected={(forestIndex) => {
          controller.selectForest(forestIndex)
        }}
      />
    )
  }, [board, controller, gameVisible, layoutMode])

  return (
    <div id="app">
      {gameScreen}
      <ReactHud />
    </div>
  )
}
