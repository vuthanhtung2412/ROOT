import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createPhaserApi } from './client.ts'
import { makeFetchResponse, makeGameState } from '../test/factories.ts'

describe('createPhaserApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates a game and returns state on success', async () => {
    const state = makeGameState({ status: 'waiting' })
    const fetchMock = vi.fn().mockResolvedValue(
      makeFetchResponse({ state }, 201),
    )
    vi.stubGlobal('fetch', fetchMock)

    const api = createPhaserApi({ baseUrl: 'http://example.test' })
    const result = await api.createGame({
      factions: ['marquise', 'eyrie'],
      replace: true,
    })

    expect(result.state.status).toBe('waiting')
    expect(fetchMock).toHaveBeenCalled()
    const firstArg = fetchMock.mock.calls[0]![0] as Request | string
    const requestUrl = typeof firstArg === 'string' ? firstArg : firstArg.url
    expect(requestUrl).toContain('/game')
  })

  it('throws ApiError with server code on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeFetchResponse({ code: 'GAME_EXISTS', detail: null }, 409),
    )
    vi.stubGlobal('fetch', fetchMock)

    const api = createPhaserApi({ baseUrl: 'http://example.test' })
    await expect(api.createGame()).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'GAME_EXISTS',
    } satisfies Partial<ApiError>)
  })

  it('submits an action and returns refreshed state', async () => {
    const state = makeGameState({ step: 'craft' })
    const fetchMock = vi.fn().mockResolvedValue(
      makeFetchResponse({ state, log: [] }, 200),
    )
    vi.stubGlobal('fetch', fetchMock)

    const api = createPhaserApi({ baseUrl: 'http://example.test' })
    const result = await api.submitAction({ type: 'endPhase' })

    expect(result.state.step).toBe('craft')
    expect(result.log).toEqual([])
  })
})
