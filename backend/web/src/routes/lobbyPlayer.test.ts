import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FactionId, PlayerState } from '@root/lib'
import { app } from '#openapi.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'

const AI_MODEL = 'anthropic:claude-opus-5-5'
const HOST_PLAYER_ID = 'host-secret'
const GUEST_PLAYER_ID = 'guest-secret'
const LATE_PLAYER_ID = 'late-secret'
const GUEST_SEAT = 1

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

function expelRequest(playerId?: string): RequestInit {
  return {
    method: 'DELETE',
    headers: playerId === undefined ? {} : { 'X-Player-Id': playerId },
  }
}

async function joinWithFaction(playerId: string, faction: FactionId): Promise<void> {
  await app.request('/game/join', jsonRequest('POST', { playerId, faction }))
}

/** Open online lobby: the host as Marquise, a guest as Eyrie. */
async function createOpenLobbyWithGuest(): Promise<void> {
  await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }))
  await joinWithFaction(HOST_PLAYER_ID, 'marquise')
  await joinWithFaction(GUEST_PLAYER_ID, 'eyrie')
}

function seatedPlayerIds(): string[] {
  const players: readonly PlayerState[] = store.game?.state.players ?? []
  return players.map((player: PlayerState): string => player.playerId)
}

describe('lobby player routes', () => {
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

  it('the host expels a guest: the seat and the faction are free again', async () => {
    await createOpenLobbyWithGuest()

    const response = await app.request(
      `/game/players/${String(GUEST_SEAT)}`,
      expelRequest(HOST_PLAYER_ID),
    )

    expect(response.status).toBe(204)
    expect(seatedPlayerIds()).toEqual([HOST_PLAYER_ID])
    await joinWithFaction(LATE_PLAYER_ID, 'eyrie')
    expect(seatedPlayerIds()).toEqual([HOST_PLAYER_ID, LATE_PLAYER_ID])
  })

  it('a guest may not expel anyone', async () => {
    await createOpenLobbyWithGuest()
    await joinWithFaction(LATE_PLAYER_ID, 'alliance')

    const response = await app.request(
      '/game/players/2',
      expelRequest(GUEST_PLAYER_ID),
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'NOT_HOST' })
    expect(seatedPlayerIds()).toHaveLength(3)
  })

  it('the host cannot expel its own seat', async () => {
    await createOpenLobbyWithGuest()

    const response = await app.request(
      '/game/players/0',
      expelRequest(HOST_PLAYER_ID),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'CANNOT_EXPEL_HOST' })
  })

  it('expelling an AI player also drops its AI seat', async () => {
    await createOpenLobbyWithGuest()
    await app.request(
      '/game/ai-players',
      jsonRequest('POST', { faction: 'alliance' }, HOST_PLAYER_ID),
    )
    expect(store.aiPlayers).toHaveLength(1)

    const response = await app.request(
      '/game/players/2',
      expelRequest(HOST_PLAYER_ID),
    )

    expect(response.status).toBe(204)
    expect(store.aiPlayers).toEqual([])
    expect(seatedPlayerIds()).toEqual([HOST_PLAYER_ID, GUEST_PLAYER_ID])
  })

  it('nobody is expelled once the game has started', async () => {
    await createOpenLobbyWithGuest()
    await app.request('/game/start', {
      method: 'POST',
      headers: { 'X-Player-Id': HOST_PLAYER_ID },
    })

    const response = await app.request(
      `/game/players/${String(GUEST_SEAT)}`,
      expelRequest(HOST_PLAYER_ID),
    )

    expect(response.status).toBe(400)
    expect(seatedPlayerIds()).toHaveLength(2)
  })

  it('404 when no game is in the slot', async () => {
    const response = await app.request('/game/players/1', expelRequest())

    expect(response.status).toBe(404)
  })
})
