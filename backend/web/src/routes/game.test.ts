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
