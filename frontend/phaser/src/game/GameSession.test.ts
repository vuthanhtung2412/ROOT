import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPhaserApi } from '../api/client.ts'
import type { GameSocketPush } from '../api/gameSocket.ts'
import {
  makeActionSpec,
  makeFetchResponse,
  makeGameState,
} from '../test/factories.ts'
import { GameSession } from './GameSession.ts'
import type { PlayerIdentityStorage } from './playerIdentity.ts'

function stubFetchSequence(
  responses: Array<{ body: unknown; status?: number }>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn()
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(
      makeFetchResponse(response.body, response.status ?? 200),
    )
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function createMemoryStorage(): PlayerIdentityStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

type SocketController = {
  push: (payload: GameSocketPush) => void
}

function createSession(options?: {
  storage?: PlayerIdentityStorage | null
  socket?: SocketController
}): GameSession {
  const socketController: SocketController = options?.socket ?? {
    push: () => {
      /* no-op until connect */
    },
  }
  let onPush: ((payload: GameSocketPush) => void) | null = null
  socketController.push = (payload) => {
    onPush?.(payload)
  }

  return new GameSession({
    api: createPhaserApi({ baseUrl: 'http://example.test' }),
    apiBaseUrl: 'http://example.test',
    identityStorage: options?.storage ?? createMemoryStorage(),
    connectSocket: ({ handlers }) => {
      onPush = handlers.onPush
      return { close: vi.fn() }
    },
    resolveSocketUrl: () => 'ws://example/ws',
  })
}

describe('GameSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('refreshes state, legal actions, and log together', async () => {
    const state = makeGameState({ step: 'craft' })
    const actions = [makeActionSpec({ type: 'craft' })]
    stubFetchSequence([
      { body: { state, historyLength: 3 } },
      { body: { actions } },
      { body: { log: [{ type: 'turnStart' }] } },
    ])

    const session = createSession()
    await session.refresh()

    const snapshot = session.getSnapshot()
    expect(snapshot.state?.step).toBe('craft')
    expect(snapshot.legalActions).toEqual(actions)
    expect(snapshot.historyLength).toBe(3)
    expect(snapshot.log).toEqual([{ type: 'turnStart' }])
    expect(snapshot.loading).toBe(false)
    expect(snapshot.error).toBeNull()
  })

  it('joinMatch first player creates lobby as marquise and waits', async () => {
    const waiting = makeGameState({ status: 'waiting' })
    const fetchMock = stubFetchSequence([
      { body: { state: waiting }, status: 201 },
      { body: { state: waiting, log: [] } },
    ])
    const socket: SocketController = { push: () => undefined }
    const session = createSession({ socket })

    const result = await session.joinMatch()

    expect(result).toBe('waiting')
    expect(fetchMock.mock.calls.length).toBe(2)
    expect(session.getLocalPlayerId()).toBe('marquise')
    expect(session.getSnapshot().error).toBeNull()

    socket.push({
      state: waiting,
      historyLength: 0,
      legalActions: [],
      log: [],
    })
    expect(session.getLocalSeat()).toBe(0)
  })

  it('joinMatch second player joins eyrie and auto-starts', async () => {
    const waiting = makeGameState({ status: 'waiting' })
    const playing = makeGameState({ status: 'playing' })
    const fetchMock = stubFetchSequence([
      { body: { code: 'GAME_EXISTS', detail: null }, status: 409 },
      { body: { state: waiting, log: [] } },
      { body: { state: playing, log: [] } },
    ])
    const socket: SocketController = { push: () => undefined }
    const session = createSession({ socket })

    const result = await session.joinMatch()

    expect(result).toBe('playing')
    expect(fetchMock.mock.calls.length).toBe(3)
    expect(session.getLocalPlayerId()).toBe('eyrie')
  })

  it('submitAction errors when local seat is not actor', async () => {
    const state = makeGameState({ currentSeat: 0 })
    const storage = createMemoryStorage()
    storage.setItem(
      'root.phaser.playerIdentity',
      JSON.stringify({ playerId: 'eyrie', apiBaseUrl: 'http://example.test' }),
    )
    const socket: SocketController = { push: () => undefined }
    const session = createSession({ storage, socket })

    await session.continueWithStoredIdentity()
    socket.push({
      state,
      historyLength: 1,
      legalActions: [],
      log: [],
    })
    await session.submitAction({ type: 'endPhase' })

    expect(session.getSnapshot().error).toBe('Not your seat')
  })

  it('submitAction allows pending fieldHospital victim not currentSeat', async () => {
    const state = makeGameState({
      currentSeat: 1,
      pending: [
        {
          type: 'fieldHospital',
          victim: 0,
          clearing: 4,
          count: 2,
        },
      ],
    })
    const storage = createMemoryStorage()
    storage.setItem(
      'root.phaser.playerIdentity',
      JSON.stringify({
        playerId: 'marquise',
        apiBaseUrl: 'http://example.test',
      }),
    )
    const fetchMock = stubFetchSequence([])
    const socket: SocketController = { push: () => undefined }
    const session = createSession({ storage, socket })

    await session.continueWithStoredIdentity()
    socket.push({
      state,
      historyLength: 1,
      legalActions: [
        makeActionSpec({ type: 'resolveEvent', actor: 0 }),
      ],
      log: [],
    })
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ state, log: [] }))
    await session.submitAction({ type: 'resolveEvent', decline: true })

    expect(session.getSnapshot().error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('submitAction posts REST without GET refresh', async () => {
    const state = makeGameState({ currentSeat: 0 })
    const fetchMock = stubFetchSequence([
      { body: { state }, status: 201 },
      { body: { state, log: [] } },
    ])
    const socket: SocketController = { push: () => undefined }
    const session = createSession({ socket })
    await session.joinMatch()
    socket.push({
      state,
      historyLength: 2,
      legalActions: [makeActionSpec()],
      log: [],
    })

    fetchMock.mockClear()
    fetchMock.mockResolvedValueOnce(makeFetchResponse({ state, log: [] }))
    await session.submitAction({ type: 'endPhase' })

    expect(fetchMock.mock.calls.length).toBe(1)
    expect(session.getSnapshot().error).toBeNull()
  })

  it('restart clears snapshot and identity', async () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'root.phaser.playerIdentity',
      JSON.stringify({ playerId: 'marquise', apiBaseUrl: '' }),
    )
    stubFetchSequence([{ body: null, status: 204 }])
    const session = createSession({ storage })

    await session.restart()

    expect(session.getSnapshot().state).toBeNull()
    expect(session.getLocalPlayerId()).toBeNull()
    expect(storage.getItem('root.phaser.playerIdentity')).toBeNull()
  })

  it('continueWithStoredIdentity errors when playerId missing from state', async () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'root.phaser.playerIdentity',
      JSON.stringify({
        playerId: 'unknown',
        apiBaseUrl: 'http://example.test',
      }),
    )
    const socket: SocketController = { push: () => undefined }
    const session = createSession({ storage, socket })
    const state = makeGameState()

    await session.continueWithStoredIdentity()
    socket.push({
      state,
      historyLength: 0,
      legalActions: [],
      log: [],
    })

    expect(session.getSnapshot().error).toBe(
      'Stored playerId not in this game',
    )
  })

  it('notifies subscribers on publish', async () => {
    const state = makeGameState()
    stubFetchSequence([
      { body: { state, historyLength: 0 } },
      { body: { actions: [] } },
      { body: { log: [] } },
    ])

    const session = createSession()
    const seen: Array<string | null> = []
    const unsubscribe = session.subscribe((snapshot) => {
      seen.push(snapshot.state?.id ?? null)
    })
    await session.refresh()
    unsubscribe()

    expect(seen[0]).toBeNull()
    expect(seen.at(-1)).toBe('test-game')
  })
})
