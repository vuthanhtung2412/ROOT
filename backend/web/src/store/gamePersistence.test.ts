import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Game } from '@root/lib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '#openapi.js'
import {
  disableGamePersistence,
  enableGamePersistence,
} from '#store/gamePersistence.js'
import { DEFAULT_LOBBY_MODE, store } from '#store/GameStore.js'

const HOST_PLAYER_ID = 'host-secret'

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

/** Reads the store through a call so TypeScript does not narrow it to null. */
function restoredFirstPlayerId(): string | undefined {
  const game: Game | null = store.game
  return game?.state.players[0]?.playerId
}

describe('game persistence', () => {
  let temporaryDirectory = ''
  let storeFile = ''

  beforeEach((): void => {
    temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'root-game-store-'))
    storeFile = path.join(temporaryDirectory, 'nested', 'game-slot.json')
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
  })

  afterEach((): void => {
    disableGamePersistence()
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
    rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  it('restores the game and its lobby mode after a restart', async () => {
    enableGamePersistence(storeFile)
    await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'], mode: 'online' }),
    )
    await app.request('/game/join', jsonRequest('POST', { playerId: HOST_PLAYER_ID }))
    expect(existsSync(storeFile)).toBe(true)

    // Simulate a server restart: memory wiped, then persistence re-enabled.
    store.game = null
    store.mode = DEFAULT_LOBBY_MODE
    enableGamePersistence(storeFile)

    expect(store.mode).toBe('online')
    expect(restoredFirstPlayerId()).toBe(HOST_PLAYER_ID)
  })

  it('removes the file when the slot is cleared', async () => {
    enableGamePersistence(storeFile)
    await app.request('/game', jsonRequest('POST', { factions: ['marquise', 'eyrie'] }))
    expect(existsSync(storeFile)).toBe(true)

    await app.request('/game', { method: 'DELETE' })

    expect(existsSync(storeFile)).toBe(false)
  })

  it('writes nothing while persistence is off', async () => {
    await app.request('/game', jsonRequest('POST', { factions: ['marquise', 'eyrie'] }))
    expect(existsSync(storeFile)).toBe(false)
  })
})
