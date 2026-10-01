import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '#openapi.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'

function jsonRequest(method: string, body: object): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

describe('game routes', () => {
  beforeEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
  })

  afterEach((): void => {
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
  })

  it('supports the game lifecycle, snapshots, undo, and slot conflicts', async () => {
    const createResponse = await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'] }),
    )
    expect(createResponse.status).toBe(201)

    const conflictResponse = await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'] }),
    )
    expect(conflictResponse.status).toBe(409)

    const firstJoinResponse = await app.request(
      '/game/join',
      jsonRequest('POST', { playerId: 'first-player' }),
    )
    const secondJoinResponse = await app.request(
      '/game/join',
      jsonRequest('POST', { playerId: 'second-player' }),
    )
    expect(firstJoinResponse.status).toBe(200)
    expect(secondJoinResponse.status).toBe(200)

    const startResponse = await app.request('/game/start', { method: 'POST' })
    expect(startResponse.status).toBe(200)
    expect(store.game?.state.status).toBe('setup')

    const historyBeforeAction = store.game?.history.length
    const actionResponse = await app.request(
      '/game/actions',
      jsonRequest('POST', { type: 'resolveEvent', clearing: 0 }),
    )
    expect(actionResponse.status).toBe(200)
    expect(store.game?.history.length).toBe((historyBeforeAction ?? 0) + 1)

    const snapshotResponse = await app.request('/game/snapshot')
    expect(snapshotResponse.status).toBe(200)
    const snapshot = await snapshotResponse.text()

    const undoResponse = await app.request('/game/undo', { method: 'POST' })
    expect(undoResponse.status).toBe(200)
    expect(store.game?.history.length).toBe(historyBeforeAction)

    const snapshotConflictResponse = await app.request('/game/snapshot', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: snapshot,
    })
    expect(snapshotConflictResponse.status).toBe(409)

    const restoreResponse = await app.request('/game/snapshot?replace=1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: snapshot,
    })
    expect(restoreResponse.status).toBe(200)
    expect(store.game?.history.length).toBe((historyBeforeAction ?? 0) + 1)
  })

  describe('online mode seat checks', () => {
    const HOST_PLAYER_ID = 'host-secret'
    const GUEST_PLAYER_ID = 'guest-secret'
    const KEEP_CORNER_ACTION = { type: 'resolveEvent', clearing: 0 }

    function asPlayer(playerId: string, method: string, body?: object): RequestInit {
      return {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Player-Id': playerId },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }
    }

    async function createOnlineLobby(): Promise<void> {
      await app.request(
        '/game',
        jsonRequest('POST', { factions: ['marquise', 'eyrie'], mode: 'online' }),
      )
      await app.request('/game/join', jsonRequest('POST', { playerId: HOST_PLAYER_ID }))
      await app.request('/game/join', jsonRequest('POST', { playerId: GUEST_PLAYER_ID }))
    }

    it('only the host may start', async () => {
      await createOnlineLobby()
      const guestStart = await app.request('/game/start', asPlayer(GUEST_PLAYER_ID, 'POST'))
      expect(guestStart.status).toBe(403)
      expect(await guestStart.json()).toMatchObject({ code: 'NOT_YOUR_SEAT' })

      const anonymousStart = await app.request('/game/start', { method: 'POST' })
      expect(anonymousStart.status).toBe(403)

      const hostStart = await app.request('/game/start', asPlayer(HOST_PLAYER_ID, 'POST'))
      expect(hostStart.status).toBe(200)
    })

    it('rejects an action from a seat that is not the actor', async () => {
      await createOnlineLobby()
      await app.request('/game/start', asPlayer(HOST_PLAYER_ID, 'POST'))

      // Setup: Marquise (host, seat 0) must choose the keep corner.
      const guestAction = await app.request(
        '/game/actions',
        asPlayer(GUEST_PLAYER_ID, 'POST', KEEP_CORNER_ACTION),
      )
      expect(guestAction.status).toBe(403)

      const anonymousAction = await app.request(
        '/game/actions',
        jsonRequest('POST', KEEP_CORNER_ACTION),
      )
      expect(anonymousAction.status).toBe(403)

      const hostAction = await app.request(
        '/game/actions',
        asPlayer(HOST_PLAYER_ID, 'POST', KEEP_CORNER_ACTION),
      )
      expect(hostAction.status).toBe(200)
    })
  })

  it('defaults to hotseat mode and reports it on GET', async () => {
    const createResponse = await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'] }),
    )
    expect(await createResponse.json()).toMatchObject({ mode: 'hotseat' })
    const getResponse = await app.request('/game')
    expect(await getResponse.json()).toMatchObject({ mode: 'hotseat' })
  })

  it('creates an online lobby; a loaded snapshot falls back to hotseat', async () => {
    const createResponse = await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'], mode: 'online' }),
    )
    expect(await createResponse.json()).toMatchObject({ mode: 'online' })
    expect(store.mode).toBe('online')

    const snapshot = await (await app.request('/game/snapshot')).text()
    const restoreResponse = await app.request('/game/snapshot?replace=1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: snapshot,
    })
    expect(restoreResponse.status).toBe(200)
    expect(store.mode).toBe('hotseat')
  })
})
