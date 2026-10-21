import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotSettings, FactionId, PlayerState } from '@root/lib'
import { app } from '#openapi.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'

const AI_MODEL = 'anthropic:claude-opus-5-5'
const HOST_PLAYER_ID = 'host-secret'
const GUEST_PLAYER_ID = 'guest-secret'
const NIGHTMARE_SWOOP: BotSettings = { difficulty: 'nightmare', traits: ['swoop'] }

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

function hostRequest(method: string): RequestInit {
  return { method, headers: { 'X-Player-Id': HOST_PLAYER_ID } }
}

async function join(playerId: string, faction: FactionId): Promise<Response> {
  return app.request('/game/join', jsonRequest('POST', { playerId, faction }))
}

async function setPlayMode(playMode: string, playerId: string = HOST_PLAYER_ID): Promise<Response> {
  return app.request('/game/play-mode', jsonRequest('PUT', { playMode }, playerId))
}

async function addBot(body: object, playerId: string = HOST_PLAYER_ID): Promise<Response> {
  return app.request('/game/bots', jsonRequest('POST', body, playerId))
}

/** Open online lobby: the host as the Alliance, a guest as the Vagabond. */
async function createOnlineLobby(): Promise<void> {
  await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }))
  await join(HOST_PLAYER_ID, 'alliance')
  await join(GUEST_PLAYER_ID, 'vagabond')
}

function seatedFactions(): FactionId[] {
  const players: readonly PlayerState[] = store.game?.state.players ?? []
  return players.map((player: PlayerState): FactionId => player.faction)
}

async function errorCodeOf(response: Response): Promise<string> {
  const body: unknown = await response.json()
  const code: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'code') : null
  return typeof code === 'string' ? code : ''
}

describe('co-op lobby routes (Rootbotics 3.5.1)', () => {
  beforeEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
    store.aiPlayers = []
    vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-secret-key-value')
    vi.stubEnv('ROOT_AI_PLAYER_MODELS', AI_MODEL)
    vi.stubEnv('ROOT_AI_PLAYER_DEFAULT_MODEL', AI_MODEL)
  })

  afterEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
    store.aiPlayers = []
    vi.unstubAllEnvs()
  })

  it('the host switches to co-op and seats a bot with its settings', async () => {
    await createOnlineLobby()

    expect((await setPlayMode('cooperative')).status).toBe(204)
    const response = await addBot({ faction: 'electricEyrie', settings: NIGHTMARE_SWOOP })

    expect(response.status).toBe(204)
    expect(store.game?.state.cooperative).toBe(true)
    expect(seatedFactions()).toEqual(['alliance', 'vagabond', 'electricEyrie'])
    expect(store.game?.state.botSettings?.electricEyrie).toEqual(NIGHTMARE_SWOOP)
  })

  it('guests may not change the mode, add or tune a bot', async () => {
    await createOnlineLobby()
    await setPlayMode('cooperative')

    expect((await setPlayMode('freeForAll', GUEST_PLAYER_ID)).status).toBe(403)
    expect((await addBot({ faction: 'electricEyrie' }, GUEST_PLAYER_ID)).status).toBe(403)
    const tune = await app.request(
      '/game/bots/electricEyrie',
      jsonRequest('PUT', { settings: NIGHTMARE_SWOOP }, GUEST_PLAYER_ID),
    )
    expect(tune.status).toBe(403)
  })

  it('switching to co-op drops the AI players; co-op takes no new one', async () => {
    await createOnlineLobby()
    await app.request('/game/ai-players', jsonRequest('POST', { faction: 'lizard' }, HOST_PLAYER_ID))
    expect(store.aiPlayers).toHaveLength(1)

    await setPlayMode('cooperative')

    expect(store.aiPlayers).toEqual([])
    expect(seatedFactions()).toEqual(['alliance', 'vagabond'])
    const aiResponse = await app.request(
      '/game/ai-players',
      jsonRequest('POST', { faction: 'lizard' }, HOST_PLAYER_ID),
    )
    expect(aiResponse.status).toBe(400)
  })

  it('a bot and the faction it replaces never sit together', async () => {
    await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }))
    await join(HOST_PLAYER_ID, 'marquise')
    await setPlayMode('cooperative')

    const botResponse = await addBot({ faction: 'mechanicalMarquise' })
    expect(botResponse.status).toBe(400)
    expect(await errorCodeOf(botResponse)).toBe('FACTION_CLASH')

    await addBot({ faction: 'electricEyrie' })
    const humanResponse = await join(GUEST_PLAYER_ID, 'eyrie')
    expect(humanResponse.status).toBe(400)
    expect(await errorCodeOf(humanResponse)).toBe('FACTION_CLASH')
  })

  it('online players cannot join as a bot faction', async () => {
    await createOnlineLobby()

    const response = await join('late-secret', 'mechanicalMarquise')

    expect(response.status).toBe(400)
    expect(await errorCodeOf(response)).toBe('BOT_FACTION')
  })

  it('co-op starts with two humans and a bot at least', async () => {
    await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }))
    await join(HOST_PLAYER_ID, 'alliance')
    await setPlayMode('cooperative')
    await addBot({ faction: 'electricEyrie' })

    const lonelyStart = await app.request('/game/start', hostRequest('POST'))
    expect(lonelyStart.status).toBe(400)
    expect(await errorCodeOf(lonelyStart)).toBe('NOT_ENOUGH_HUMANS')

    await join(GUEST_PLAYER_ID, 'vagabond')
    const start = await app.request('/game/start', hostRequest('POST'))
    expect(start.status).toBe(200)
  })

  it('co-op with no bot does not start', async () => {
    await createOnlineLobby()
    await setPlayMode('cooperative')

    const response = await app.request('/game/start', hostRequest('POST'))

    expect(response.status).toBe(400)
    expect(await errorCodeOf(response)).toBe('NO_BOT')
  })

  it('back to free-for-all: the bots leave, their settings stay', async () => {
    await createOnlineLobby()
    await setPlayMode('cooperative')
    await addBot({ faction: 'mechanicalMarquise', settings: { difficulty: 'easy', traits: [] } })
    await addBot({ faction: 'electricEyrie' })

    await setPlayMode('freeForAll')

    expect(store.game?.state.cooperative).toBeUndefined()
    expect(seatedFactions()).toEqual(['alliance', 'vagabond'])
    expect(store.game?.state.botSettings?.mechanicalMarquise?.difficulty).toBe('easy')
  })

  it('rejects traits of the other bot', async () => {
    await createOnlineLobby()
    await setPlayMode('cooperative')

    const response = await addBot({
      faction: 'mechanicalMarquise',
      settings: { difficulty: 'default', traits: ['swoop'] },
    })

    expect(response.status).toBe(400)
  })
})
