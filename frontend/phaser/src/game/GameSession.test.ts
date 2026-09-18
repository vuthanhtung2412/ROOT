import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPhaserApi } from '../api/client.ts'
import { makeActionSpec, makeFetchResponse, makeGameState } from '../test/factories.ts'
import { GameSession } from './GameSession.ts'

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

    const session = new GameSession(
      createPhaserApi({ baseUrl: 'http://example.test' }),
    )
    await session.refresh()

    const snapshot = session.getSnapshot()
    expect(snapshot.state?.step).toBe('craft')
    expect(snapshot.legalActions).toEqual(actions)
    expect(snapshot.historyLength).toBe(3)
    expect(snapshot.log).toEqual([{ type: 'turnStart' }])
    expect(snapshot.loading).toBe(false)
    expect(snapshot.error).toBeNull()
  })

  it('startHotSeatGame creates, joins, starts, then refreshes', async () => {
    const waiting = makeGameState({ status: 'waiting' })
    const playing = makeGameState({ status: 'playing', step: 'birdsong' })
    const fetchMock = stubFetchSequence([
      { body: { state: waiting }, status: 201 },
      { body: { state: waiting, log: [] } },
      { body: { state: waiting, log: [] } },
      { body: { state: playing, log: [] } },
      { body: { state: playing, historyLength: 4 } },
      { body: { actions: [makeActionSpec()] } },
      { body: { log: [] } },
    ])

    const session = new GameSession(
      createPhaserApi({ baseUrl: 'http://example.test' }),
    )
    await session.startHotSeatGame({
      factions: ['marquise', 'eyrie'],
      playerIds: ['marquise', 'eyrie'],
    })

    expect(session.getSnapshot().state?.status).toBe('playing')
    expect(fetchMock.mock.calls.length).toBe(7)
  })

  it('submitAction refreshes after success', async () => {
    const after = makeGameState({ step: 'actions' })
    stubFetchSequence([
      { body: { state: after, log: [] } },
      { body: { state: after, historyLength: 5 } },
      { body: { actions: [] } },
      { body: { log: [{ type: 'action' }] } },
    ])

    const session = new GameSession(
      createPhaserApi({ baseUrl: 'http://example.test' }),
    )
    await session.submitAction({ type: 'endPhase' })

    expect(session.getSnapshot().state?.step).toBe('actions')
    expect(session.getSnapshot().historyLength).toBe(5)
  })

  it('undo refreshes after success', async () => {
    const undone = makeGameState({ turn: 1 })
    stubFetchSequence([
      { body: { state: undone } },
      { body: { state: undone, historyLength: 2 } },
      { body: { actions: [makeActionSpec()] } },
      { body: { log: [] } },
    ])

    const session = new GameSession(
      createPhaserApi({ baseUrl: 'http://example.test' }),
    )
    await session.undo()

    expect(session.getSnapshot().historyLength).toBe(2)
    expect(session.getSnapshot().error).toBeNull()
  })

  it('restart clears snapshot after delete', async () => {
    stubFetchSequence([{ body: null, status: 204 }])

    const session = new GameSession(
      createPhaserApi({ baseUrl: 'http://example.test' }),
    )
    await session.restart()

    expect(session.getSnapshot().state).toBeNull()
    expect(session.getSnapshot().legalActions).toEqual([])
  })

  it('keeps prior snapshot and sets error on failure', async () => {
    const state = makeGameState()
    stubFetchSequence([
      { body: { state, historyLength: 1 } },
      { body: { actions: [] } },
      { body: { log: [] } },
      { body: { code: 'BAD_ACTION', detail: null }, status: 400 },
    ])

    const session = new GameSession(
      createPhaserApi({ baseUrl: 'http://example.test' }),
    )
    await session.refresh()
    await session.submitAction({ type: 'recruit' })

    expect(session.getSnapshot().state).toEqual(state)
    expect(session.getSnapshot().error).toBe('BAD_ACTION')
    expect(session.getSnapshot().loading).toBe(false)
  })

  it('notifies subscribers on publish', async () => {
    const state = makeGameState()
    stubFetchSequence([
      { body: { state, historyLength: 0 } },
      { body: { actions: [] } },
      { body: { log: [] } },
    ])

    const session = new GameSession(
      createPhaserApi({ baseUrl: 'http://example.test' }),
    )
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
