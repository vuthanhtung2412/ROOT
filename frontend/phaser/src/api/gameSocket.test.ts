import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  connectGameSocket,
  resolveWebSocketUrl,
  type GameSocketPush,
  type SocketLike,
} from './gameSocket.ts'

type ListenerMap = Map<string, Set<(event: Event) => void>>

function createMockSocket(): {
  socket: SocketLike
  emit: (type: string, event: Event) => void
  sendMessage: (data: unknown) => void
} {
  const listeners: ListenerMap = new Map()

  const socket: SocketLike = {
    close: vi.fn(),
    addEventListener: (type: string, listener: (event: Event) => void) => {
      const existing = listeners.get(type) ?? new Set()
      existing.add(listener)
      listeners.set(type, existing)
    },
  }

  return {
    socket,
    emit: (type, event) => {
      for (const listener of listeners.get(type) ?? []) {
        listener(event)
      }
    },
    sendMessage: (data) => {
      const event = new MessageEvent('message', {
        data: JSON.stringify(data),
      })
      for (const listener of listeners.get('message') ?? []) {
        listener(event)
      }
    },
  }
}

describe('resolveWebSocketUrl', () => {
  it('maps empty base to same-origin /ws', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'http:', host: 'localhost:5173' },
    })
    expect(resolveWebSocketUrl('', 'marquise')).toBe(
      'ws://localhost:5173/ws?playerId=marquise',
    )
  })

  it('maps empty base on https Funnel host to wss', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        host: 'laptop.tailnet.ts.net',
      },
    })
    expect(resolveWebSocketUrl('', 'eyrie')).toBe(
      'wss://laptop.tailnet.ts.net/ws?playerId=eyrie',
    )
  })

  it('maps https API base to wss host', () => {
    expect(
      resolveWebSocketUrl('https://machine.tailnet.ts.net', 'marquise'),
    ).toBe('wss://machine.tailnet.ts.net/ws?playerId=marquise')
  })
  it('maps http API base to ws host', () => {
    expect(resolveWebSocketUrl('http://192.168.1.10:3000', 'eyrie')).toBe(
      'ws://192.168.1.10:3000/ws?playerId=eyrie',
    )
  })
})

describe('connectGameSocket', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('forwards valid push payloads', () => {
    const mock = createMockSocket()
    const onPush = vi.fn()
    connectGameSocket({
      url: 'ws://example/ws?playerId=a',
      handlers: { onPush },
      webSocketFactory: () => mock.socket,
      maxReconnectAttempts: 0,
    })

    const payload: GameSocketPush = {
      state: null,
      historyLength: 0,
      legalActions: [],
      log: [],
    }
    mock.sendMessage(payload)

    expect(onPush).toHaveBeenCalledWith(payload)
  })

  it('ignores malformed JSON pushes', () => {
    const mock = createMockSocket()
    const onPush = vi.fn()
    connectGameSocket({
      url: 'ws://example/ws?playerId=a',
      handlers: { onPush },
      webSocketFactory: () => mock.socket,
      maxReconnectAttempts: 0,
    })

    mock.emit(
      'message',
      new MessageEvent('message', { data: '{not-json' }),
    )

    expect(onPush).not.toHaveBeenCalled()
  })

  it('reconnects lightly after unexpected close', () => {
    vi.useFakeTimers()
    const first = createMockSocket()
    const second = createMockSocket()
    const factory = vi
      .fn()
      .mockReturnValueOnce(first.socket)
      .mockReturnValueOnce(second.socket)

    connectGameSocket({
      url: 'ws://example/ws?playerId=a',
      handlers: { onPush: vi.fn() },
      webSocketFactory: factory,
      maxReconnectAttempts: 1,
      reconnectDelayMilliseconds: 100,
    })

    first.emit('close', new Event('close'))
    expect(factory).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('resets reconnect budget after successful open', () => {
    vi.useFakeTimers()
    const sockets = [
      createMockSocket(),
      createMockSocket(),
      createMockSocket(),
    ]
    const factory = vi
      .fn()
      .mockReturnValueOnce(sockets[0]!.socket)
      .mockReturnValueOnce(sockets[1]!.socket)
      .mockReturnValueOnce(sockets[2]!.socket)

    connectGameSocket({
      url: 'ws://example/ws?playerId=a',
      handlers: { onPush: vi.fn() },
      webSocketFactory: factory,
      maxReconnectAttempts: 1,
      reconnectDelayMilliseconds: 50,
    })

    sockets[0]!.emit('open', new Event('open'))
    sockets[0]!.emit('close', new Event('close'))
    vi.advanceTimersByTime(50)
    expect(factory).toHaveBeenCalledTimes(2)

    sockets[1]!.emit('open', new Event('open'))
    sockets[1]!.emit('close', new Event('close'))
    vi.advanceTimersByTime(50)
    expect(factory).toHaveBeenCalledTimes(3)
  })
})
