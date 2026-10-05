import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFrontendApi } from '#api/client.ts'
import type { GameSocketPush } from '#api/gameSocket.ts'
import {
  makeActionSpec,
  makeFetchResponse,
  makeGameState,
} from '#test/factories.ts'
import { GameSession } from '#game/GameSession.ts'
import type { PlayerIdentityStorage } from '#game/playerIdentity.ts'

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
  generatePlayerId?: () => string
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
    api: createFrontendApi({ baseUrl: 'http://example.test' }),
    apiBaseUrl: 'http://example.test',
    identityStorage: options?.storage ?? createMemoryStorage(),
    connectSocket: ({ handlers }) => {
      onPush = handlers.onPush
      return { close: vi.fn() }
    },
    resolveSocketUrl: () => 'ws://example/ws',
    ...(options?.generatePlayerId === undefined
      ? {}
      : { generatePlayerId: options.generatePlayerId }),
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

  it('drops a refresh superseded by a newer one (no stale or mixed snapshot)', async () => {
    const staleState = makeGameState({ step: 'revolt' })
    const freshState = makeGameState({ step: 'spread' })
    const freshActions = [makeActionSpec({ type: 'spreadSympathy' })]
    stubFetchSequence([
      { body: { state: staleState, historyLength: 1 } },
      { body: { actions: [makeActionSpec({ type: 'endPhase' })] } },
      { body: { log: [] } },
      { body: { state: freshState, historyLength: 2 } },
      { body: { actions: freshActions } },
      { body: { log: [] } },
    ])

    const session = createSession()
    const publishedSteps: Array<string | undefined> = []
    session.subscribe((snapshot) => {
      if (snapshot.state !== null) publishedSteps.push(snapshot.state.step)
    })
    await Promise.all([session.refresh(), session.refresh()])

    expect(publishedSteps).not.toContain('revolt')
    expect(session.getSnapshot().state?.step).toBe('spread')
    expect(session.getSnapshot().legalActions).toEqual(freshActions)
  })

  describe('online play', () => {
    const HOST_PLAYER_ID = 'player-host'
    const GUEST_PLAYER_ID = 'player-guest'

    function lobbyState(joinedPlayerIds: string[]): ReturnType<typeof makeGameState> {
      const full = makeGameState({ status: 'waiting' })
      return {
        ...full,
        players: joinedPlayerIds.map((playerId, seat) => ({
          ...full.players[seat]!,
          playerId,
        })),
      }
    }

    it('host creates an online lobby and takes seat 0', async () => {
      const fetchMock = stubFetchSequence([
        { body: { state: lobbyState([]), mode: 'online' }, status: 201 },
        { body: { state: lobbyState([HOST_PLAYER_ID]), log: [] } },
      ])
      const storage = createMemoryStorage()
      const session = createSession({
        storage,
        generatePlayerId: () => HOST_PLAYER_ID,
      })

      const hosted = await session.hostOnlineGame(['marquise', 'eyrie'])

      expect(hosted).toBe(true)
      const createRequest: unknown = fetchMock.mock.calls[0]![0]
      if (!(createRequest instanceof Request)) throw new Error('expected Request')
      expect(await createRequest.json()).toMatchObject({ mode: 'online' })
      expect(session.getLocalPlayerId()).toBe(HOST_PLAYER_ID)
      expect(session.getLocalSeat()).toBe(0)
      expect(session.isOnlineHost()).toBe(true)
      expect(storage.getItem('root.react.playerIdentity')).toContain(HOST_PLAYER_ID)
    })

    it('host replaces a leftover hotseat game in the slot', async () => {
      const fetchMock = stubFetchSequence([
        { body: { code: 'GAME_EXISTS', detail: null }, status: 409 },
        {
          body: {
            state: makeGameState({ status: 'setup' }),
            historyLength: 3,
            mode: 'hotseat',
          },
        },
        { body: { state: lobbyState([]), mode: 'online' }, status: 201 },
        { body: { state: lobbyState([HOST_PLAYER_ID]), log: [] } },
      ])
      const session = createSession({ generatePlayerId: () => HOST_PLAYER_ID })

      const hosted = await session.hostOnlineGame(['marquise', 'eyrie'])

      expect(hosted).toBe(true)
      const replaceRequest: unknown = fetchMock.mock.calls[2]![0]
      if (!(replaceRequest instanceof Request)) throw new Error('expected Request')
      expect(new URL(replaceRequest.url).searchParams.get('replace')).toBe('1')
      expect(session.isOnlineHost()).toBe(true)
    })

    it('host does not replace a live online game', async () => {
      const fetchMock = stubFetchSequence([
        { body: { code: 'GAME_EXISTS', detail: null }, status: 409 },
        {
          body: {
            state: lobbyState([GUEST_PLAYER_ID]),
            historyLength: 0,
            mode: 'online',
          },
        },
      ])
      const session = createSession({ generatePlayerId: () => HOST_PLAYER_ID })

      expect(await session.hostOnlineGame(['marquise', 'eyrie'])).toBe(false)
      expect(session.getSnapshot().error).toBe(
        'A game is already running on this server',
      )
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('guest joins the next free seat of a waiting online lobby', async () => {
      stubFetchSequence([
        {
          body: {
            state: lobbyState([HOST_PLAYER_ID]),
            historyLength: 0,
            mode: 'online',
          },
        },
        {
          body: {
            state: lobbyState(['hidden-seat-0', GUEST_PLAYER_ID]),
            log: [],
          },
        },
      ])
      const session = createSession({ generatePlayerId: () => GUEST_PLAYER_ID })

      const joined = await session.joinOnlineGame()

      expect(joined).toBe(true)
      expect(session.getLocalSeat()).toBe(1)
      expect(session.isOnlineHost()).toBe(false)
    })

    it('guest cannot join a hotseat or missing game', async () => {
      stubFetchSequence([
        {
          body: {
            state: lobbyState([HOST_PLAYER_ID]),
            historyLength: 0,
            mode: 'hotseat',
          },
        },
      ])
      const session = createSession({ generatePlayerId: () => GUEST_PLAYER_ID })

      expect(await session.joinOnlineGame()).toBe(false)
      expect(session.getSnapshot().error).toBe(
        'The game on this server cannot be joined',
      )
      expect(session.getLocalPlayerId()).toBeNull()
    })

    it('resumes the stored seat after a reload', async () => {
      const playing = {
        ...makeGameState({ status: 'playing' }),
        players: lobbyState(['hidden-seat-0', GUEST_PLAYER_ID]).players,
      }
      stubFetchSequence([
        { body: { state: playing, historyLength: 4, mode: 'online' } },
      ])
      const storage = createMemoryStorage()
      storage.setItem(
        'root.react.playerIdentity',
        JSON.stringify({
          playerId: GUEST_PLAYER_ID,
          apiBaseUrl: 'http://example.test',
        }),
      )
      const session = createSession({ storage })

      expect(await session.resumeOnlineGame()).toBe(true)
      expect(session.getLocalSeat()).toBe(1)
      expect(session.getRequestPlayerId()).toBe(GUEST_PLAYER_ID)
    })

    it('guest End game only leaves: no delete, join id kept for rejoin', async () => {
      const playing = {
        ...makeGameState({ status: 'playing' }),
        players: lobbyState(['hidden-seat-0', GUEST_PLAYER_ID]).players,
      }
      const fetchMock = stubFetchSequence([
        { body: { state: playing, historyLength: 4, mode: 'online' } },
      ])
      const storage = createMemoryStorage()
      storage.setItem(
        'root.react.playerIdentity',
        JSON.stringify({
          playerId: GUEST_PLAYER_ID,
          apiBaseUrl: 'http://example.test',
        }),
      )
      const session = createSession({ storage })
      await session.resumeOnlineGame()

      await session.restart()

      expect(fetchMock.mock.calls.length).toBe(1)
      expect(session.getSnapshot().state).toBeNull()
      expect(storage.getItem('root.react.playerIdentity')).toContain(GUEST_PLAYER_ID)
    })

    it('forgets a stored id that no longer owns a seat', async () => {
      stubFetchSequence([
        {
          body: {
            state: lobbyState(['hidden-seat-0', 'hidden-seat-1']),
            historyLength: 0,
            mode: 'online',
          },
        },
      ])
      const storage = createMemoryStorage()
      storage.setItem(
        'root.react.playerIdentity',
        JSON.stringify({
          playerId: GUEST_PLAYER_ID,
          apiBaseUrl: 'http://example.test',
        }),
      )
      const session = createSession({ storage })

      expect(await session.resumeOnlineGame()).toBe(false)
      expect(session.getLocalPlayerId()).toBeNull()
      expect(storage.getItem('root.react.playerIdentity')).toBeNull()
    })
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
      'root.react.playerIdentity',
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
      'root.react.playerIdentity',
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
      'root.react.playerIdentity',
      JSON.stringify({ playerId: 'marquise', apiBaseUrl: '' }),
    )
    stubFetchSequence([{ body: null, status: 204 }])
    const session = createSession({ storage })

    await session.restart()

    expect(session.getSnapshot().state).toBeNull()
    expect(session.getLocalPlayerId()).toBeNull()
    expect(storage.getItem('root.react.playerIdentity')).toBeNull()
  })

  it('clears identity when another player ends the game', async () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
      JSON.stringify({ playerId: 'marquise', apiBaseUrl: '' }),
    )
    const socket: SocketController = { push: () => undefined }
    const session = createSession({ storage, socket })
    await session.continueWithStoredIdentity()

    socket.push({
      state: null,
      historyLength: 0,
      legalActions: [],
      log: [],
    })

    expect(session.getSnapshot().state).toBeNull()
    expect(session.getLocalPlayerId()).toBeNull()
    expect(storage.getItem('root.react.playerIdentity')).toBeNull()
  })

  it('startLocalParty creates, joins all seats, starts, follows actor', async () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
      JSON.stringify({ playerId: 'stale', apiBaseUrl: 'http://old' }),
    )
    const setupState = makeGameState({
      status: 'setup',
      currentSeat: 0,
      factions: ['marquise', 'eyrie', 'alliance'],
      players: [
        {
          seat: 0,
          playerId: 'marquise',
          faction: 'marquise',
          vp: 0,
          hand: [],
        },
        {
          seat: 1,
          playerId: 'eyrie',
          faction: 'eyrie',
          vp: 0,
          hand: [],
        },
        {
          seat: 2,
          playerId: 'alliance',
          faction: 'alliance',
          vp: 0,
          hand: [],
        },
      ],
    })
    const fetchMock = stubFetchSequence([
      { body: { state: setupState }, status: 201 },
      { body: { state: setupState, log: [] } },
      { body: { state: setupState, log: [] } },
      { body: { state: setupState, log: [] } },
      { body: { state: setupState, log: [] } },
      { body: { state: setupState, historyLength: 4 } },
      { body: { actions: [makeActionSpec({ type: 'resolveEvent', actor: 0 })] } },
      { body: { log: [] } },
    ])
    const session = createSession({ storage })
    const ok = await session.startLocalParty([
      'marquise',
      'eyrie',
      'alliance',
    ])
    expect(ok).toBe(true)
    expect(session.getSnapshot().state?.status).toBe('setup')
    expect(session.getSnapshot().state?.factions).toEqual([
      'marquise',
      'eyrie',
      'alliance',
    ])
    expect(session.getLocalPlayerId()).toBe('marquise')
    expect(storage.getItem('root.react.playerIdentity')).toBeNull()
    // create + 3×join + start + refresh(get/legal/log) = 8
    expect(fetchMock.mock.calls.length).toBe(8)
  })

  it('continueQaLoadedGame binds actor, opens socket, skips identity save', async () => {
    const state = makeGameState({ currentSeat: 1 })
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
      JSON.stringify({
        playerId: 'marquise',
        apiBaseUrl: 'http://example.test',
      }),
    )
    const connectCalls: string[] = []
    stubFetchSequence([
      { body: { state, historyLength: 2 } },
      { body: { actions: [makeActionSpec({ type: 'turmoil', actor: 1 })] } },
      { body: { log: [] } },
    ])
    const session = new GameSession({
      api: createFrontendApi({ baseUrl: 'http://example.test' }),
      apiBaseUrl: 'http://example.test',
      identityStorage: storage,
      connectSocket: ({ url, handlers }) => {
        connectCalls.push(url)
        void handlers
        return { close: vi.fn() }
      },
      resolveSocketUrl: (_base, playerId) => `ws://example/ws?playerId=${playerId}`,
    })

    await session.continueQaLoadedGame()

    expect(session.getLocalPlayerId()).toBe('eyrie')
    expect(session.getLocalSeat()).toBe(1)
    expect(connectCalls).toEqual(['ws://example/ws?playerId=eyrie'])
    expect(storage.getItem('root.react.playerIdentity')).toContain('marquise')
  })

  it('continueQaLoadedGame loads the given snapshot into the slot first', async () => {
    const state = makeGameState({ currentSeat: 1 })
    const snapshot = {
      state,
      history: [],
      log: [],
      rng: { seed: 1, cursor: 0 },
    }
    const fetchMock = stubFetchSequence([
      { body: { state } },
      { body: { state, historyLength: 0 } },
      { body: { actions: [] } },
      { body: { log: [] } },
    ])
    const session = new GameSession({
      api: createFrontendApi({ baseUrl: 'http://example.test' }),
      apiBaseUrl: 'http://example.test',
      identityStorage: createMemoryStorage(),
      connectSocket: () => ({ close: vi.fn() }),
      resolveSocketUrl: (_base, playerId) => `ws://example/ws?playerId=${playerId}`,
    })

    await session.continueQaLoadedGame(snapshot)

    const loadRequest: unknown = fetchMock.mock.calls[0]?.[0]
    expect(loadRequest).toBeInstanceOf(Request)
    if (loadRequest instanceof Request) {
      expect(loadRequest.method).toBe('PUT')
      expect(loadRequest.url).toBe('http://example.test/game/snapshot?replace=1')
    }
    expect(session.getLocalSeat()).toBe(1)
  })

  it('qaMode socket push wakes REST refresh (not applySocketPush)', async () => {
    const before = makeGameState({ currentSeat: 1, step: 'decree' })
    const after = makeGameState({
      currentSeat: 1,
      step: 'decree',
      pending: [{ type: 'chooseLeader', seat: 1, reason: 'depose' }],
    })
    const socket: SocketController = { push: () => undefined }
    const fetchMock = stubFetchSequence([
      { body: { state: before, historyLength: 1 } },
      { body: { actions: [makeActionSpec({ type: 'turmoil', actor: 1 })] } },
      { body: { log: [] } },
      { body: { state: after, historyLength: 2 } },
      {
        body: {
          actions: [
            makeActionSpec({
              type: 'resolveEvent',
              actor: 1,
              params: { leaders: ['charismatic', 'commander', 'despot'] },
            }),
          ],
        },
      },
      { body: { log: [{ t: 'action' }] } },
    ])
    const session = createSession({ socket })
    await session.continueQaLoadedGame()
    fetchMock.mockClear()

    socket.push({
      state: after,
      historyLength: 2,
      legalActions: [],
      log: [],
    })
    await vi.waitFor(() => {
      expect(session.getSnapshot().state?.pending).toEqual([
        { type: 'chooseLeader', seat: 1, reason: 'depose' },
      ])
    })

    expect(fetchMock.mock.calls.length).toBe(3)
    expect(session.getSnapshot().legalActions[0]?.type).toBe('resolveEvent')
  })

  it('qaMode restart clears stale Play identity', async () => {
    const state = makeGameState({ currentSeat: 1 })
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
      JSON.stringify({
        playerId: 'marquise',
        apiBaseUrl: 'http://example.test',
      }),
    )
    stubFetchSequence([
      { body: { state, historyLength: 0 } },
      { body: { actions: [] } },
      { body: { log: [] } },
      { body: null, status: 204 },
    ])
    const session = createSession({ storage })
    await session.continueQaLoadedGame()
    await session.restart()

    expect(session.getSnapshot().state).toBeNull()
    expect(session.getLocalPlayerId()).toBeNull()
    expect(storage.getItem('root.react.playerIdentity')).toBeNull()
  })

  it('play resumes when stored seat still in slot', async () => {
    const playing = makeGameState({ status: 'playing' })
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
      JSON.stringify({
        playerId: 'marquise',
        apiBaseUrl: 'http://example.test',
      }),
    )
    const fetchMock = stubFetchSequence([
      { body: { state: playing, historyLength: 4 } },
    ])
    const socket: SocketController = { push: () => undefined }
    const session = createSession({ storage, socket })

    const result = await session.play()

    expect(result).toBe('continued')
    expect(session.getLocalPlayerId()).toBe('marquise')
    expect(session.getSnapshot().state?.status).toBe('playing')
    expect(fetchMock.mock.calls.length).toBe(1)
  })

  it('play joins when no stored identity', async () => {
    const waiting = makeGameState({ status: 'waiting' })
    stubFetchSequence([
      { body: { state: waiting }, status: 201 },
      { body: { state: waiting, log: [] } },
    ])
    const session = createSession()

    const result = await session.play()

    expect(result).toBe('waiting')
    expect(session.getLocalPlayerId()).toBe('marquise')
  })

  it('play joins a new game after restart', async () => {
    const waiting = makeGameState({ status: 'waiting' })
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
      JSON.stringify({ playerId: 'marquise', apiBaseUrl: '' }),
    )
    stubFetchSequence([
      { body: null, status: 204 },
      { body: { state: waiting }, status: 201 },
      { body: { state: waiting, log: [] } },
    ])
    const session = createSession({ storage })

    await session.restart()
    const result = await session.play()

    expect(result).toBe('waiting')
    expect(session.getLocalPlayerId()).toBe('marquise')
    expect(storage.getItem('root.react.playerIdentity')).toContain('marquise')
  })

  it('play clears stale identity and joins when seat missing', async () => {
    const playing = makeGameState({ status: 'playing' })
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
      JSON.stringify({
        playerId: 'unknown',
        apiBaseUrl: 'http://example.test',
      }),
    )
    stubFetchSequence([
      { body: { state: playing, historyLength: 1 } },
      { body: { code: 'GAME_EXISTS', detail: null }, status: 409 },
      { body: { state: makeGameState({ status: 'waiting' }), log: [] } },
      { body: { state: playing, log: [] } },
    ])
    const session = createSession({ storage })

    const result = await session.play()

    expect(result).toBe('playing')
    expect(session.getLocalPlayerId()).toBe('eyrie')
    expect(storage.getItem('root.react.playerIdentity')).toContain('eyrie')
  })

  it('play joins when API has no game', async () => {
    const waiting = makeGameState({ status: 'waiting' })
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
      JSON.stringify({
        playerId: 'marquise',
        apiBaseUrl: 'http://example.test',
      }),
    )
    stubFetchSequence([
      { body: { code: 'NO_GAME', detail: null }, status: 404 },
      { body: { state: waiting }, status: 201 },
      { body: { state: waiting, log: [] } },
    ])
    const session = createSession({ storage })

    const result = await session.play()

    expect(result).toBe('waiting')
    expect(session.getLocalPlayerId()).toBe('marquise')
  })

  it('play does not resume finished games', async () => {
    const finished = makeGameState({ status: 'finished' })
    const waiting = makeGameState({ status: 'waiting' })
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
      JSON.stringify({
        playerId: 'marquise',
        apiBaseUrl: 'http://example.test',
      }),
    )
    stubFetchSequence([
      { body: { state: finished, historyLength: 9 } },
      { body: { code: 'GAME_EXISTS', detail: null }, status: 409 },
      { body: { state: waiting, log: [] } },
      { body: { state: makeGameState({ status: 'playing' }), log: [] } },
    ])
    const session = createSession({ storage })

    const result = await session.play()

    expect(result).toBe('playing')
    expect(session.getLocalPlayerId()).toBe('eyrie')
  })

  it('continueWithStoredIdentity errors when playerId missing from state', async () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'root.react.playerIdentity',
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
