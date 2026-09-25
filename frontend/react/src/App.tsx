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
  autumnMapPublicPath,
  CORE_IMAGE_ASSETS,
} from '#assets/gameAssets.ts'
import { GameSession, type PlayResult } from '#game/GameSession.ts'
import {
  getHudSnapshot,
  setMenuCallbacks,
  subscribeHud,
} from '#game/hudStore.ts'
import { loadPlayerIdentity } from '#game/playerIdentity.ts'
import { ReactGameController } from '#game/ReactGameController.ts'
import {
  clearBootLoading,
  syncBootLoading,
} from '#react/BootOverlay.tsx'
import { GameScreen } from '#react/GameScreen.tsx'
import {
  showMenuShell,
  syncMenuPlayPending,
  syncMenuStatus,
} from '#react/MenuOverlay.tsx'
import { ReactHud } from '#react/ReactHud.tsx'
import { useViewportLayoutMode } from '#react/useViewportLayoutMode.ts'

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
  const handlePlayRef = useRef<() => void>(() => undefined)
  const handleQaContinueRef = useRef<() => void>(() => undefined)

  if (controllerRef.current === null) {
    controllerRef.current = new ReactGameController()
  }
  const controller = controllerRef.current

  const board = useSyncExternalStore(
    (listener) => controller.subscribeBoard(listener),
    () => controller.getBoardSnapshot(),
    () => controller.getBoardSnapshot(),
  )

  const ensureSession = useCallback((): GameSession => {
    if (sessionRef.current !== null) {
      return sessionRef.current
    }
    const session = new GameSession({
      api: createFrontendApi({ baseUrl: apiBaseUrlInput }),
      apiBaseUrl: apiBaseUrlInput,
    })
    sessionRef.current = session
    return session
  }, [apiBaseUrlInput])

  const clearLobbyWait = useCallback((): void => {
    if (lobbyUnsubscribeRef.current !== null) {
      lobbyUnsubscribeRef.current()
      lobbyUnsubscribeRef.current = null
    }
  }, [])

  const enterGame = useCallback((): void => {
    clearLobbyWait()
    const session = ensureSession()
    void controller.start(session, () => {
      showMenuShell(import.meta.env.DEV === true)
    })
  }, [clearLobbyWait, controller, ensureSession])

  const rebindSessionApi = useCallback(
    (baseUrl: string): void => {
      const session = ensureSession()
      session.rebindApi(createFrontendApi({ baseUrl }), baseUrl)
    },
    [ensureSession],
  )

  const handlePlay = useCallback(async (): Promise<void> => {
    if (playPendingRef.current) {
      return
    }
    playPendingRef.current = true
    syncMenuPlayPending(true)
    clearLobbyWait()
    const stored = loadPlayerIdentity()
    const nextBase =
      stored !== null && stored.apiBaseUrl !== ''
        ? stored.apiBaseUrl
        : resolveDefaultApiBaseUrl()
    setApiBaseUrlInput(nextBase)
    rebindSessionApi(nextBase)
    syncMenuStatus(
      stored !== null ? 'Checking seat…' : 'Joining…',
      '#9a9a9a',
    )

    const session = ensureSession()
    let result: PlayResult | null
    try {
      result = await session.play()
    } catch (error: unknown) {
      const message: string =
        error instanceof Error ? error.message : 'Play failed'
      syncMenuStatus(message, '#c44')
      playPendingRef.current = false
      syncMenuPlayPending(false)
      return
    }
    playPendingRef.current = false
    syncMenuPlayPending(false)

    if (result === null) {
      syncMenuStatus(session.getSnapshot().error ?? 'Play failed', '#c44')
      return
    }

    if (result === 'continued') {
      const snapshot = session.getSnapshot()
      if (
        snapshot.state?.status === 'playing' ||
        snapshot.state?.status === 'setup'
      ) {
        enterGame()
        return
      }
      syncMenuStatus('Waiting for second player…', '#9a9a9a')
    } else if (result === 'playing') {
      syncMenuStatus('Starting…', '#9a9a9a')
    } else {
      syncMenuStatus('Waiting for second player…', '#9a9a9a')
    }

    clearLobbyWait()
    lobbyUnsubscribeRef.current = session.subscribe((snapshot) => {
      if (snapshot.error !== null) {
        syncMenuStatus(snapshot.error, '#c44')
        return
      }
      if (
        snapshot.state?.status === 'playing' ||
        snapshot.state?.status === 'setup'
      ) {
        enterGame()
      }
    })
  }, [clearLobbyWait, ensureSession, enterGame, rebindSessionApi])

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

  handlePlayRef.current = () => {
    void handlePlay()
  }
  handleQaContinueRef.current = () => {
    void handleQaContinue()
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
      showMenuShell(import.meta.env.DEV === true)
      setMenuCallbacks({
        onPlay: () => {
          handlePlayRef.current()
        },
        onQaContinue: () => {
          handleQaContinueRef.current()
        },
      })
    })()
    return () => {
      cancelled = true
      clearLobbyWait()
      controller.stop()
    }
  }, [clearLobbyWait, controller])

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
        highlightedClearingIds={board.highlightedClearingIds}
        onClearingSelected={(clearingId) => {
          controller.selectClearing(clearingId)
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
