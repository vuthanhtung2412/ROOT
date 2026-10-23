import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PlayerState } from '@root/lib'
import { app } from '#openapi.js'
import { roomRegistry } from '#store/roomRegistry.js'
import { onlyOnlineRoom, resetAllRooms } from '#test/roomFixtures.js'

const HOST_PLAYER_ID = 'host-secret'
const GUEST_PLAYER_ID = 'guest-secret'
const OTHER_HOST_PLAYER_ID = 'other-host-secret'

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

/** The host opens an online lobby and sits as the Marquise; returns the room code. */
async function openLobbyAsHost(): Promise<string> {
  await app.request('/game', asPlayer(HOST_PLAYER_ID, 'POST', { factions: [], mode: 'online' }))
  await app.request(
    '/game/join',
    asPlayer(HOST_PLAYER_ID, 'POST', { playerId: HOST_PLAYER_ID, faction: 'marquise' }),
  )
  return onlyOnlineRoom().roomCode ?? ''
}

async function enter(roomCode: string, playerId: string | undefined): Promise<Response> {
  return app.request(`/game/rooms/${roomCode}/enter`, asPlayer(playerId, 'POST'))
}

async function leave(playerId: string): Promise<Response> {
  return app.request('/game/leave', asPlayer(playerId, 'POST'))
}

function seatedPlayerIds(): string[] {
  const players: readonly PlayerState[] = onlyOnlineRoom().game?.state.players ?? []
  return players.map((player: PlayerState): string => player.playerId)
}

describe('room routes', () => {
  beforeEach(resetAllRooms)
  afterEach(resetAllRooms)

  it('a guest enters by code (any case), then sees and joins the lobby', async () => {
    const roomCode = await openLobbyAsHost()

    const entered = await enter(roomCode.toLowerCase(), GUEST_PLAYER_ID)

    expect(entered.status).toBe(200)
    expect(await entered.json()).toEqual({ roomCode, mode: 'online' })
    const view = await app.request('/game', asPlayer(GUEST_PLAYER_ID, 'GET'))
    expect(await view.json()).toMatchObject({ roomCode })
    await app.request(
      '/game/join',
      asPlayer(GUEST_PLAYER_ID, 'POST', { playerId: GUEST_PLAYER_ID, faction: 'eyrie' }),
    )
    expect(seatedPlayerIds()).toEqual([HOST_PLAYER_ID, GUEST_PLAYER_ID])
  })

  it('unknown code → 404; no join id → 400', async () => {
    const roomCode = await openLobbyAsHost()

    const unknown = await enter('NOPE99', GUEST_PLAYER_ID)
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toMatchObject({ code: 'ROOM_NOT_FOUND' })

    const anonymous = await enter(roomCode, undefined)
    expect(anonymous.status).toBe(400)
  })

  it('a player in another unfinished game cannot enter; entering the same room again is fine', async () => {
    const roomCode = await openLobbyAsHost()
    await app.request(
      '/game',
      asPlayer(OTHER_HOST_PLAYER_ID, 'POST', { factions: [], mode: 'online' }),
    )

    const busy = await enter(roomCode, OTHER_HOST_PLAYER_ID)
    expect(busy.status).toBe(409)
    expect(await busy.json()).toMatchObject({ code: 'ALREADY_IN_GAME' })

    expect((await enter(roomCode, HOST_PLAYER_ID)).status).toBe(200)
  })

  it('a lobby guest leaves: seat freed, free to open another game', async () => {
    const roomCode = await openLobbyAsHost()
    await enter(roomCode, GUEST_PLAYER_ID)
    await app.request(
      '/game/join',
      asPlayer(GUEST_PLAYER_ID, 'POST', { playerId: GUEST_PLAYER_ID, faction: 'eyrie' }),
    )

    expect((await leave(GUEST_PLAYER_ID)).status).toBe(204)

    expect(seatedPlayerIds()).toEqual([HOST_PLAYER_ID])
    expect(roomRegistry.roomOfPlayer(GUEST_PLAYER_ID)).toBeNull()
  })

  it('the host cannot leave the lobby; nobody leaves a game in progress', async () => {
    const roomCode = await openLobbyAsHost()
    await enter(roomCode, GUEST_PLAYER_ID)
    await app.request(
      '/game/join',
      asPlayer(GUEST_PLAYER_ID, 'POST', { playerId: GUEST_PLAYER_ID, faction: 'eyrie' }),
    )

    const hostLeave = await leave(HOST_PLAYER_ID)
    expect(hostLeave.status).toBe(409)
    expect(await hostLeave.json()).toMatchObject({ code: 'HOST_MUST_END' })

    await app.request('/game/start', asPlayer(HOST_PLAYER_ID, 'POST'))
    const guestLeave = await leave(GUEST_PLAYER_ID)
    expect(guestLeave.status).toBe(409)
    expect(await guestLeave.json()).toMatchObject({ code: 'GAME_IN_PROGRESS' })
    expect(roomRegistry.roomOfPlayer(GUEST_PLAYER_ID)).toBe(onlyOnlineRoom())
  })

  it('in a lobby nobody sat in, a guest neither ends the room nor leaves with it', async () => {
    await app.request('/game', asPlayer(HOST_PLAYER_ID, 'POST', { factions: [], mode: 'online' }))
    const roomCode = onlyOnlineRoom().roomCode ?? ''
    await enter(roomCode, GUEST_PLAYER_ID)

    const guestDelete = await app.request('/game', asPlayer(GUEST_PLAYER_ID, 'DELETE'))
    expect(guestDelete.status).toBe(403)
    expect(await guestDelete.json()).toMatchObject({ code: 'NOT_HOST' })

    expect((await leave(GUEST_PLAYER_ID)).status).toBe(204)
    expect(roomRegistry.roomOfPlayer(GUEST_PLAYER_ID)).toBeNull()
    expect(roomRegistry.roomOfPlayer(HOST_PLAYER_ID)).toBe(onlyOnlineRoom())
  })

  it('the creator leaving a lobby nobody sat in ends the room', async () => {
    await app.request('/game', asPlayer(HOST_PLAYER_ID, 'POST', { factions: [], mode: 'online' }))
    await enter(onlyOnlineRoom().roomCode ?? '', GUEST_PLAYER_ID)

    expect((await leave(HOST_PLAYER_ID)).status).toBe(204)

    expect(roomRegistry.rooms()).toEqual([])
    expect(roomRegistry.roomOfPlayer(GUEST_PLAYER_ID)).toBeNull()
  })

  it('an unseated watcher leaves at any time', async () => {
    const roomCode = await openLobbyAsHost()
    await enter(roomCode, GUEST_PLAYER_ID)

    expect((await leave(GUEST_PLAYER_ID)).status).toBe(204)
    expect(roomRegistry.roomOfPlayer(GUEST_PLAYER_ID)).toBeNull()
  })
})
