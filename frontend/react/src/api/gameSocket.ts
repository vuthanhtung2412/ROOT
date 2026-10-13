import type { ActionSpec, AiPlayer, GameState } from '#api/client.ts'

export type GameSocketPush = {
  state: GameState | null
  historyLength: number
  legalActions: ActionSpec[]
  log: unknown[]
  /** Seats played by an LLM. Absent on pushes of an older server. */
  aiPlayers?: AiPlayer[]
}

export type GameSocketHandlers = {
  onPush: (payload: GameSocketPush) => void
  onClose?: () => void
  onError?: () => void
}

export type GameSocketConnection = {
  close: () => void
}

/** Minimal socket surface so tests need no `WebSocket` cast. */
export type SocketLike = {
  addEventListener: (
    type: string,
    listener: (event: Event) => void,
  ) => void
  close: () => void
}

export type ConnectGameSocketOptions = {
  url: string
  handlers: GameSocketHandlers
  /** Max automatic reconnect attempts after unexpected close. Default 5. */
  maxReconnectAttempts?: number
  /** Base delay ms for reconnect backoff. Default 500. */
  reconnectDelayMilliseconds?: number
  /** Injected socket for tests. */
  webSocketFactory?: (url: string) => SocketLike
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGameSocketPush(value: unknown): value is GameSocketPush {
  if (!isRecord(value)) {
    return false
  }
  if (!('state' in value)) {
    return false
  }
  if (typeof value.historyLength !== 'number') {
    return false
  }
  if (!Array.isArray(value.legalActions)) {
    return false
  }
  if (!Array.isArray(value.log)) {
    return false
  }
  return true
}

function messageData(event: Event): string | null {
  if (!isRecord(event)) {
    return null
  }
  if (typeof event.data !== 'string') {
    return null
  }
  return event.data
}

/**
 * Connect to `@root/web` game push socket.
 * Parses JSON pushes; light reconnect on unexpected close.
 */
export function connectGameSocket(
  options: ConnectGameSocketOptions,
): GameSocketConnection {
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 5
  const reconnectDelayMilliseconds = options.reconnectDelayMilliseconds ?? 500
  const createSocket =
    options.webSocketFactory ?? ((url: string) => new WebSocket(url))

  let closedByUser = false
  let reconnectAttempts = 0
  let socket: SocketLike | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function attach(current: SocketLike): void {
    current.addEventListener('open', () => {
      reconnectAttempts = 0
    })

    current.addEventListener('message', (event: Event) => {
      const data = messageData(event)
      if (data === null) {
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(data)
      } catch {
        return
      }
      if (!isGameSocketPush(parsed)) {
        return
      }
      options.handlers.onPush(parsed)
    })

    current.addEventListener('error', () => {
      options.handlers.onError?.()
    })

    current.addEventListener('close', () => {
      if (closedByUser) {
        options.handlers.onClose?.()
        return
      }
      if (reconnectAttempts >= maxReconnectAttempts) {
        options.handlers.onClose?.()
        return
      }
      reconnectAttempts += 1
      const delay = reconnectDelayMilliseconds * reconnectAttempts
      reconnectTimer = setTimeout(() => {
        open()
      }, delay)
    })
  }

  function open(): void {
    socket = createSocket(options.url)
    attach(socket)
  }

  open()

  return {
    close: () => {
      closedByUser = true
      clearReconnectTimer()
      socket?.close()
      socket = null
    },
  }
}

/**
 * Build WS URL from REST API base.
 * Empty base → same-origin `/ws` (Vite proxy). Absolute http(s) → ws(s).
 */
export function resolveWebSocketUrl(
  apiBaseUrl: string,
  playerId: string,
): string {
  const query = `playerId=${encodeURIComponent(playerId)}`
  if (apiBaseUrl === '' || apiBaseUrl === '/') {
    if (typeof window !== 'undefined' && window.location !== undefined) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}/ws?${query}`
    }
    return `ws://localhost:5173/ws?${query}`
  }

  const httpUrl = new URL(apiBaseUrl)
  const wsProtocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${httpUrl.host}/ws?${query}`
}
