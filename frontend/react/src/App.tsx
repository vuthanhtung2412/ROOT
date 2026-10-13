import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import { createFrontendApi } from '#api/client.ts'
import { resolveDefaultApiBaseUrl } from '#api/defaultApiBaseUrl.ts'
import {
  MENU_BOOT_IMAGE_ASSETS,
  WARM_GAME_IMAGE_ASSETS,
} from '#assets/gameAssets.ts'
import { GameSession, type GameSessionSnapshot } from '#game/GameSession.ts'
import {
  clearHotseatGameOpen,
  isHotseatGameOpen,
  markHotseatGameOpen,
  reloadHotseatSlot,
} from '#game/hotseatResume.ts'
import { getHudSnapshot, setMenuCallbacks, subscribeHud } from '#game/hudStore.ts'
import { buildMenuLobby } from '#game/menuLobby.ts'
import {
  fetchQaSnapshot,
  readQaSnapshotPath,
} from '#game/qaSnapshotAutoload.ts'
import { ReactGameController } from '#game/ReactGameController.ts'
import {
  clearBootLoading,
  syncBootLoading,
} from '#react/BootOverlay.tsx'
import { GameScreen } from '#react/GameScreen.tsx'
import {
  showMenuShell,
  syncMenuLobby,
  syncMenuLobbyOnServer,
  syncMenuPlayPending,
  syncMenuStatus,
} from '#react/MenuOverlay.tsx'
import { ReactHud } from '#react/ReactHud.tsx'
import { useViewportFit } from '#react/useViewportFit.ts'
import { useViewportLayoutMode } from '#react/useViewportLayoutMode.ts'

/** How often the menu asks the server whether a lobby waits to be joined. */
const LOBBY_STATUS_POLL_MS = 2500

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

async function prefetchImagePaths(
  paths: readonly string[],
  onProgress: ((value: number) => void) | null,
): Promise<void> {
  let loaded = 0
  const total = Math.max(paths.length, 1)
  await Promise.all(
    paths.map(async (path) => {
      await prefetchImage(path)
      loaded += 1
      if (onProgress !== null) {
        onProgress(loaded / total)
      }
    }),
  )
}

async function prefetchMenuBootAssets(
  onProgress: (value: number) => void,
): Promise<void> {
  await prefetchImagePaths(
    MENU_BOOT_IMAGE_ASSETS.map((asset) => asset.path),
    onProgress,
  )
}

async function prefetchWarmGameAssets(): Promise<void> {
  await prefetchImagePaths(
    WARM_GAME_IMAGE_ASSETS.map((asset) => asset.path),
    null,
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
  const handlePlayOnlineRef = useRef<() => void>(() => undefined)
  const handlePickFactionRef = useRef<(faction: string) => void>(
    () => undefined,
  )
  const handleStartOnlineRef = useRef<() => void>(() => undefined)
  const handleLeaveOnlineRef = useRef<() => void>(() => undefined)
  const resumeOnlineGameRef = useRef<() => Promise<void>>(() =>
    Promise.resolve(),
  )
  const resumeHotseatGameRef = useRef<() => Promise<void>>(() =>
    Promise.resolve(),
  )
  /** Boards / tokens / map warming after the menu; enterGame waits on it. */
  const warmGameAssetsPromiseRef = useRef<Promise<void> | null>(null)

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
      onPlayOnline: () => {
        handlePlayOnlineRef.current()
      },
      onPickFaction: (faction) => {
        handlePickFactionRef.current(faction)
      },
      onStartOnline: () => {
        handleStartOnlineRef.current()
      },
      onLeaveOnline: () => {
        handleLeaveOnlineRef.current()
      },
    })
  }, [])

  const enterGame = useCallback((): void => {
    void (async (): Promise<void> => {
      clearLobbyWait()
      const warmGameAssets = warmGameAssetsPromiseRef.current
      if (warmGameAssets !== null) {
        await warmGameAssets
      }
      const session = ensureSession()
      void controller.start(session, () => {
        clearHotseatGameOpen()
        showMenu()
      })
    })()
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
    const showLobby = (snapshot: GameSessionSnapshot): void => {
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
    }
    lobbyUnsubscribeRef.current = session.subscribe(showLobby)
    // The lobby is on screen at once, not only after the next server push.
    if (session.getSnapshot().state !== null) {
      showLobby(session.getSnapshot())
    }
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

  /** The one start button: join the waiting lobby, or create one. */
  const handlePlayOnline = useCallback(
    (): Promise<void> =>
      runOnlineLobbyAction('Opening lobby…', (session) =>
        session.enterOnlineLobby(),
      ),
    [runOnlineLobbyAction],
  )

  /** Open lobby: take a seat with the faction, or change the pick. */
  const handlePickFaction = useCallback(
    async (faction: string): Promise<void> => {
      const session = ensureSession()
      const picked: boolean = await session.pickLobbyFaction(faction)
      syncMenuStatus(
        picked ? '' : (session.getSnapshot().error ?? 'Could not pick'),
        picked ? '#9a9a9a' : '#c44',
      )
    },
    [ensureSession],
  )

  const handleStartOnline = useCallback(async (): Promise<void> => {
    const session = ensureSession()
    await session.startOnlineGame()
    const error = session.getSnapshot().error
    if (error !== null) {
      syncMenuStatus(error, '#c44')
    }
  }, [ensureSession])

  /** Leave the lobby screen: the host closes the game, a guest steps out. */
  const handleLeaveOnline = useCallback(async (): Promise<void> => {
    if (playPendingRef.current) {
      return
    }
    playPendingRef.current = true
    syncMenuPlayPending(true)
    // Stop watching first: our own leave is not "the game was closed".
    clearLobbyWait()
    const session = ensureSession()
    await session.leaveOnlineLobby()
    playPendingRef.current = false
    syncMenuPlayPending(false)
    const error = session.getSnapshot().error
    if (error !== null) {
      syncMenuStatus(error, '#c44')
      watchOnlineLobby()
      return
    }
    syncMenuLobby(null)
    syncMenuStatus('', '#9a9a9a')
  }, [clearLobbyWait, ensureSession, watchOnlineLobby])

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
      let started: boolean
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
        markHotseatGameOpen()
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
    const qaSnapshotPath: string | null = readQaSnapshotPath(
      window.location.search,
      import.meta.env.ROOT_QA_SNAPSHOT_PATH,
    )
    if (qaSnapshotPath === null) {
      syncMenuStatus('QA loading slot…', '#9a9a9a')
      await session.continueQaLoadedGame()
    } else {
      syncMenuStatus(`QA loading ${qaSnapshotPath}…`, '#9a9a9a')
      try {
        await session.continueQaLoadedGame(await fetchQaSnapshot(qaSnapshotPath))
      } catch (error: unknown) {
        syncMenuStatus(
          error instanceof Error ? error.message : String(error),
          '#c44',
        )
        return
      }
    }
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
    markHotseatGameOpen()
    enterGame()
  }, [apiBaseUrlInput, ensureSession, enterGame, rebindSessionApi])

  handleStartPartyRef.current = (factions: string[]) => {
    void handleStartParty(factions)
  }
  handleQaContinueRef.current = () => {
    void handleQaContinue()
  }
  handlePlayOnlineRef.current = () => {
    void handlePlayOnline()
  }
  handlePickFactionRef.current = (faction: string) => {
    void handlePickFaction(faction)
  }
  handleLeaveOnlineRef.current = () => {
    void handleLeaveOnline()
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
  resumeHotseatGameRef.current = async (): Promise<void> => {
    if (!isHotseatGameOpen()) {
      return
    }
    if (await reloadHotseatSlot(ensureSession())) {
      enterGame()
      return
    }
    clearHotseatGameOpen()
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      syncBootLoading(0)
      await prefetchMenuBootAssets((value) => {
        if (!cancelled) {
          syncBootLoading(value)
        }
      })
      if (cancelled) {
        return
      }
      clearBootLoading()
      showMenu()
      // Boards / map / tokens: fetch while the player is on the menu.
      warmGameAssetsPromiseRef.current = prefetchWarmGameAssets()
      // Reload in an online game: take the stored seat back.
      await resumeOnlineGameRef.current()
      // Reload in a hotseat / QA game (dev code edit): go straight back in.
      await resumeHotseatGameRef.current()
    })()
    return () => {
      cancelled = true
      clearLobbyWait()
      controller.stop()
    }
  }, [clearLobbyWait, controller, showMenu])

  // Menu: the start button reads "Join game" while a lobby waits on the server.
  useEffect(() => {
    if (shell !== 'menu') {
      return undefined
    }
    let cancelled = false
    const askServer = async (): Promise<void> => {
      const hasLiveGame: boolean = await ensureSession()
        .hasLiveOnlineGame()
        .catch((): boolean => false)
      if (!cancelled) {
        syncMenuLobbyOnServer(hasLiveGame)
      }
    }
    void askServer()
    const timer: number = window.setInterval(() => {
      void askServer()
    }, LOBBY_STATUS_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ensureSession, shell])

  const gameVisible = shell === 'game'
  const viewportZoom = useViewportFit()
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
        effects={board.effects}
        flashedClearing={board.flashedClearing}
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
    <div id="app" style={{ zoom: viewportZoom }}>
      {gameScreen}
      <ReactHud />
    </div>
  )
}
