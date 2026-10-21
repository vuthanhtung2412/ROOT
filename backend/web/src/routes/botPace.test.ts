import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '#openapi.js'
import {
  DEFAULT_BOT_STEP_DELAY_SECONDS,
  DEFAULT_LOBBY_MODE,
  store,
} from '#store/GameStore.js'

const HOST_PLAYER_ID = 'host-secret'
const GUEST_PLAYER_ID = 'guest-secret'
const FAST_PACE_SECONDS = 1
const UNOFFERED_PACE_SECONDS = 3

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

async function setPace(seconds: number, playerId?: string): Promise<Response> {
  return app.request('/game/bot-pace', jsonRequest('PUT', { botStepDelaySeconds: seconds }, playerId))
}

async function createLobby(mode: string): Promise<void> {
  await app.request('/game', jsonRequest('POST', { factions: [], mode }))
  await app.request('/game/join', jsonRequest('POST', { playerId: HOST_PLAYER_ID, faction: 'alliance' }))
  await app.request('/game/join', jsonRequest('POST', { playerId: GUEST_PLAYER_ID, faction: 'vagabond' }))
}

function resetStore(): void {
  store.game = null
  store.mode = DEFAULT_LOBBY_MODE
  store.aiPlayers = []
  store.botStepDelaySeconds = DEFAULT_BOT_STEP_DELAY_SECONDS
}

describe('bot pace route', () => {
  beforeEach(resetStore)
  afterEach(resetStore)

  it('the online host sets the pace; the game view reports it', async () => {
    await createLobby('online')

    const response = await setPace(FAST_PACE_SECONDS, HOST_PLAYER_ID)

    expect(response.status).toBe(204)
    const view: unknown = await (
      await app.request('/game', { headers: { 'X-Player-Id': GUEST_PLAYER_ID } })
    ).json()
    expect(view).toEqual(expect.objectContaining({ botStepDelaySeconds: FAST_PACE_SECONDS }))
  })

  it('an online guest may not', async () => {
    await createLobby('online')

    expect((await setPace(FAST_PACE_SECONDS, GUEST_PLAYER_ID)).status).toBe(403)
    expect(store.botStepDelaySeconds).toBe(DEFAULT_BOT_STEP_DELAY_SECONDS)
  })

  it('takes only an offered pace', async () => {
    await createLobby('online')

    expect((await setPace(UNOFFERED_PACE_SECONDS, HOST_PLAYER_ID)).status).toBe(400)
  })

  it('a new game starts at the default pace', async () => {
    await createLobby('online')
    await setPace(FAST_PACE_SECONDS, HOST_PLAYER_ID)

    await app.request('/game?replace=1', jsonRequest('POST', { factions: [] }, HOST_PLAYER_ID))

    expect(store.botStepDelaySeconds).toBe(DEFAULT_BOT_STEP_DELAY_SECONDS)
  })
})
