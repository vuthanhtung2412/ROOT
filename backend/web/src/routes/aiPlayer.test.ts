import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aiPlayerDriver } from '#aiPlayer/aiPlayerRuntime.js'
import { app } from '#openapi.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'
import { snapshotGamePushForViewer } from '#ws/GameHub.js'

const ANTHROPIC_API_KEY = 'anthropic-secret-key-value'
const OPENAI_API_KEY = 'openai-secret-key-value'
const DEFAULT_MODEL = 'anthropic:claude-opus-5-5'
const OTHER_MODEL = 'openai:some-model'
const HOST_PLAYER_ID = 'host-secret'
const GUEST_PLAYER_ID = 'guest-secret'

function jsonRequest(method: string, body: object, playerId?: string): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(playerId === undefined ? {} : { 'X-Player-Id': playerId }),
    },
    body: JSON.stringify(body),
  }
}

async function createLobby(body: object): Promise<void> {
  await app.request('/game', jsonRequest('POST', body))
}

describe('AI player routes', () => {
  beforeEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
    store.aiPlayers = []
    vi.stubEnv('ANTHROPIC_API_KEY', ANTHROPIC_API_KEY)
    vi.stubEnv('OPENAI_API_KEY', OPENAI_API_KEY)
    vi.stubEnv('ROOT_AI_PLAYER_MODELS', `${DEFAULT_MODEL},${OTHER_MODEL}`)
    vi.stubEnv('ROOT_AI_PLAYER_DEFAULT_MODEL', DEFAULT_MODEL)
  })

  afterEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
    store.aiPlayers = []
    vi.unstubAllEnvs()
  })

  it('lists the offered models and the default', async () => {
    const response = await app.request('/game/ai-models')

    expect(await response.json()).toEqual({
      models: [DEFAULT_MODEL, OTHER_MODEL],
      defaultModel: DEFAULT_MODEL,
    })
  })

  it('offers no model of a provider without API key', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const response = await app.request('/game/ai-models')

    expect(await response.json()).toEqual({
      models: [DEFAULT_MODEL],
      defaultModel: DEFAULT_MODEL,
    })
  })

  it('seats an AI player with the default model and shows it to viewers', async () => {
    await createLobby({ factions: ['marquise', 'eyrie'] })

    const response = await app.request('/game/ai-players', { method: 'POST' })

    expect(response.status).toBe(201)
    const expectedAiPlayers = [{ seat: 0, model: DEFAULT_MODEL, status: 'idle' }]
    expect(await response.json()).toEqual({ aiPlayers: expectedAiPlayers })
    expect(store.game?.state.players).toHaveLength(1)
    const game = await app.request('/game')
    expect(await game.json()).toMatchObject({ aiPlayers: expectedAiPlayers })
    expect(snapshotGamePushForViewer('anyone').aiPlayers).toEqual(
      expectedAiPlayers,
    )
  })

  it('seats an AI player with a chosen model and faction', async () => {
    await createLobby({ factions: [] })
    await app.request('/game/join', jsonRequest('POST', { playerId: 'human' }))

    const response = await app.request(
      '/game/ai-players',
      jsonRequest('POST', { faction: 'eyrie', model: OTHER_MODEL }),
    )

    const aiPlayer = store.game?.state.players.find(
      (player) => player.playerId === store.aiPlayers[0]?.playerId,
    )
    expect(aiPlayer?.faction).toBe('eyrie')
    expect(await response.json()).toEqual({
      aiPlayers: [{ seat: aiPlayer?.seat, model: OTHER_MODEL, status: 'idle' }],
    })
  })

  it('rejects a model the server does not offer', async () => {
    await createLobby({ factions: ['marquise', 'eyrie'] })

    const response = await app.request(
      '/game/ai-players',
      jsonRequest('POST', { model: 'anthropic:not-offered' }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'BAD_MODEL' })
    expect(store.aiPlayers).toEqual([])
  })

  it('rejects an AI player when no model is configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
    await createLobby({ factions: ['marquise', 'eyrie'] })

    const response = await app.request('/game/ai-players', { method: 'POST' })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'NO_AI_MODEL' })
  })

  it('changes the model in the lobby, not after the game started', async () => {
    await createLobby({ factions: ['marquise', 'eyrie'] })
    await app.request('/game/join', jsonRequest('POST', { playerId: 'human' }))
    await app.request('/game/ai-players', { method: 'POST' })

    const humanSeat = await app.request(
      '/game/ai-players/0',
      jsonRequest('PATCH', { model: OTHER_MODEL }),
    )
    expect(humanSeat.status).toBe(404)
    expect(await humanSeat.json()).toMatchObject({ code: 'NO_AI_PLAYER' })

    const changed = await app.request(
      '/game/ai-players/1',
      jsonRequest('PATCH', { model: OTHER_MODEL }),
    )
    expect(changed.status).toBe(200)
    expect(await changed.json()).toEqual({
      aiPlayers: [{ seat: 1, model: OTHER_MODEL, status: 'idle' }],
    })

    // Started: the AI seat stays out of the way (seat 0 owes the first choice).
    await app.request('/game/start', { method: 'POST' })
    const afterStart = await app.request(
      '/game/ai-players/1',
      jsonRequest('PATCH', { model: DEFAULT_MODEL }),
    )
    expect(afterStart.status).toBe(409)
    expect(await afterStart.json()).toMatchObject({ code: 'GAME_STARTED' })
    const lateJoin = await app.request('/game/ai-players', { method: 'POST' })
    expect(lateJoin.status).toBe(409)
  })

  it('online mode: only the host seats AI players', async () => {
    await createLobby({ factions: ['marquise', 'eyrie', 'alliance'], mode: 'online' })
    await app.request('/game/join', jsonRequest('POST', { playerId: HOST_PLAYER_ID }))
    await app.request('/game/join', jsonRequest('POST', { playerId: GUEST_PLAYER_ID }))

    const byGuest = await app.request(
      '/game/ai-players',
      jsonRequest('POST', {}, GUEST_PLAYER_ID),
    )
    expect(byGuest.status).toBe(403)
    expect(await byGuest.json()).toMatchObject({ code: 'NOT_HOST' })

    const byHost = await app.request(
      '/game/ai-players',
      jsonRequest('POST', {}, HOST_PLAYER_ID),
    )
    expect(byHost.status).toBe(201)
  })

  it('restarts the session of an AI seat for any caller, 404 for a human seat', async () => {
    const restart = vi.spyOn(aiPlayerDriver, 'restart').mockReturnValue(true)
    await createLobby({ factions: ['marquise', 'eyrie'], mode: 'online' })
    await app.request('/game/join', jsonRequest('POST', { playerId: HOST_PLAYER_ID }))
    await app.request('/game/ai-players', jsonRequest('POST', {}, HOST_PLAYER_ID))

    const humanSeat = await app.request('/game/ai-players/0/restart', {
      method: 'POST',
    })
    expect(humanSeat.status).toBe(404)
    expect(restart).not.toHaveBeenCalled()

    const aiSeat = await app.request('/game/ai-players/1/restart', {
      method: 'POST',
    })
    expect(aiSeat.status).toBe(200)
    expect(await aiSeat.json()).toEqual({
      aiPlayers: [{ seat: 1, model: DEFAULT_MODEL, status: 'idle' }],
    })
    expect(restart).toHaveBeenCalledWith(1)
    restart.mockRestore()
  })

  it('never sends an API key or an AI join id to a client', async () => {
    await createLobby({ factions: ['marquise', 'eyrie'] })
    const added = await app.request('/game/ai-players', { method: 'POST' })
    const aiPlayerId = store.aiPlayers[0]?.playerId ?? ''
    expect(aiPlayerId).not.toBe('')

    const bodies = [
      await added.text(),
      await (await app.request('/game/ai-models')).text(),
      await (await app.request('/game?view=player')).text(),
      await (await app.request('/doc')).text(),
      JSON.stringify(snapshotGamePushForViewer('anyone')),
    ]

    for (const body of bodies) {
      expect(body).not.toContain(ANTHROPIC_API_KEY)
      expect(body).not.toContain(OPENAI_API_KEY)
      expect(body).not.toContain(aiPlayerId)
    }
  })
})
