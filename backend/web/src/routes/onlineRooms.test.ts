import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '#openapi.js'
import { store } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'
import { resetAllRooms } from '#test/roomFixtures.js'
import { snapshotGamePushForViewer } from '#ws/GameHub.js'

const FIRST_HOST_PLAYER_ID = 'first-host-secret'
const SECOND_HOST_PLAYER_ID = 'second-host-secret'

function asPlayer(playerId: string | undefined, method: string, body?: object): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(playerId === undefined ? {} : { 'X-Player-Id': playerId }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

async function createOnlineRoom(playerId: string | undefined): Promise<Response> {
  return app.request('/game', asPlayer(playerId, 'POST', { factions: [], mode: 'online' }))
}

async function roomCodeOf(response: Response): Promise<unknown> {
  const body: unknown = await response.json()
  return typeof body === 'object' && body !== null ? Reflect.get(body, 'roomCode') : null
}

describe('online rooms', () => {
  beforeEach(resetAllRooms)
  afterEach(resetAllRooms)

  it('two hosts get two rooms; each sees only its own', async () => {
    const firstCreate = await createOnlineRoom(FIRST_HOST_PLAYER_ID)
    const secondCreate = await createOnlineRoom(SECOND_HOST_PLAYER_ID)
    expect(firstCreate.status).toBe(201)
    expect(secondCreate.status).toBe(201)
    const firstCode = await roomCodeOf(firstCreate)
    const secondCode = await roomCodeOf(secondCreate)
    expect(firstCode).not.toBe(secondCode)

    await app.request(
      '/game/join',
      asPlayer(FIRST_HOST_PLAYER_ID, 'POST', { playerId: FIRST_HOST_PLAYER_ID, faction: 'marquise' }),
    )

    const secondView = await app.request('/game', asPlayer(SECOND_HOST_PLAYER_ID, 'GET'))
    expect(await secondView.json()).toMatchObject({
      roomCode: secondCode,
      state: { players: [] },
    })
    expect(snapshotGamePushForViewer(FIRST_HOST_PLAYER_ID).roomCode).toBe(firstCode)
    // Neither room touches the hotseat slot.
    expect(store.game).toBeNull()
  })

  it('a player in an unfinished game cannot open another', async () => {
    const firstCreate = await createOnlineRoom(FIRST_HOST_PLAYER_ID)

    const again = await createOnlineRoom(FIRST_HOST_PLAYER_ID)

    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({
      code: 'ALREADY_IN_GAME',
      detail: { roomCode: await roomCodeOf(firstCreate) },
    })
    expect(roomRegistry.rooms()).toHaveLength(1)
  })

  it('an online room needs the creator join id', async () => {
    const response = await createOnlineRoom(undefined)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'PLAYER_ID_REQUIRED' })
    expect(roomRegistry.rooms()).toEqual([])
  })
})
