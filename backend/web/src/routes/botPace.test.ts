import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '#openapi.js'
import { DEFAULT_BOT_STEP_DELAY_SECONDS } from '#store/GameStore.js'
import {
  enterOnlyOnlineRoom,
  onlyOnlineRoom,
  resetAllRooms,
} from '#test/roomFixtures.js'

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

/** Online room made by the host, host and guest seated. */
async function createOnlineLobby(): Promise<void> {
  await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }, HOST_PLAYER_ID))
  enterOnlyOnlineRoom(GUEST_PLAYER_ID)
  await app.request('/game/join', jsonRequest('POST', { playerId: HOST_PLAYER_ID, faction: 'alliance' }))
  await app.request('/game/join', jsonRequest('POST', { playerId: GUEST_PLAYER_ID, faction: 'vagabond' }))
}

describe('bot pace route', () => {
  beforeEach(resetAllRooms)
  afterEach(resetAllRooms)

  it('the online host sets the pace; the game view reports it', async () => {
    await createOnlineLobby()

    const response = await setPace(FAST_PACE_SECONDS, HOST_PLAYER_ID)

    expect(response.status).toBe(204)
    const view: unknown = await (
      await app.request('/game', { headers: { 'X-Player-Id': GUEST_PLAYER_ID } })
    ).json()
    expect(view).toEqual(expect.objectContaining({ botStepDelaySeconds: FAST_PACE_SECONDS }))
  })

  it('an online guest may not', async () => {
    await createOnlineLobby()

    expect((await setPace(FAST_PACE_SECONDS, GUEST_PLAYER_ID)).status).toBe(403)
    expect(onlyOnlineRoom().botStepDelaySeconds).toBe(DEFAULT_BOT_STEP_DELAY_SECONDS)
  })

  it('takes only an offered pace', async () => {
    await createOnlineLobby()

    expect((await setPace(UNOFFERED_PACE_SECONDS, HOST_PLAYER_ID)).status).toBe(400)
  })

  it('a new game starts at the default pace', async () => {
    await createOnlineLobby()
    await setPace(FAST_PACE_SECONDS, HOST_PLAYER_ID)

    await app.request('/game', { method: 'DELETE', headers: { 'X-Player-Id': HOST_PLAYER_ID } })
    await createOnlineLobby()

    expect(onlyOnlineRoom().botStepDelaySeconds).toBe(DEFAULT_BOT_STEP_DELAY_SECONDS)
  })
})
