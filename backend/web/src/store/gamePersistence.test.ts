import { existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Game } from '@root/lib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from '#openapi.js'
import {
  clearStoredGame,
  disableGamePersistence,
  enableGamePersistence,
  persistRoom,
} from '#store/gamePersistence.js'
import { DEFAULT_LOBBY_MODE, store, type GameRoom } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'
import { resetAllRooms } from '#test/roomFixtures.js'

const HOST_PLAYER_ID = 'host-secret'
const OTHER_HOST_PLAYER_ID = 'other-host-secret'
const FIRST_ROOM_CODE = 'AAAAAA'
const LAST_ROOM_CODE = 'ZZZZZZ'

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
    resetAllRooms()
  })

  afterEach((): void => {
    disableGamePersistence()
    resetAllRooms()
    rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  it('restores the hotseat game and its lobby mode after a restart', async () => {
    enableGamePersistence(storeFile)
    await app.request(
      '/game',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'], mode: 'hotseat' }),
    )
    await app.request('/game/join', jsonRequest('POST', { playerId: HOST_PLAYER_ID }))
    expect(existsSync(storeFile)).toBe(true)

    // Simulate a server restart: memory wiped, then persistence re-enabled.
    store.game = null
    store.mode = 'online'
    enableGamePersistence(storeFile)

    expect(store.mode).toBe(DEFAULT_LOBBY_MODE)
    expect(restoredFirstPlayerId()).toBe(HOST_PLAYER_ID)
  })

  it('restores the AI seats; a new game starts without them', async () => {
    enableGamePersistence(storeFile)
    await app.request('/game', jsonRequest('POST', { factions: ['marquise', 'eyrie'] }))
    store.aiPlayers = [
      {
        playerId: 'ai-seat-secret',
        model: 'anthropic:claude-opus-5-5',
        status: 'stuck',
      },
    ]
    await app.request('/game/join', jsonRequest('POST', { playerId: 'ai-seat-secret' }))

    store.game = null
    store.aiPlayers = []
    enableGamePersistence(storeFile)

    // The live status is not saved: a restarted server starts the seat idle.
    expect(store.aiPlayers).toEqual([
      {
        playerId: 'ai-seat-secret',
        model: 'anthropic:claude-opus-5-5',
        status: 'idle',
      },
    ])

    await app.request(
      '/game?replace=1',
      jsonRequest('POST', { factions: ['marquise', 'eyrie'] }),
    )
    expect(store.aiPlayers).toEqual([])
  })

  it('removes the file when the slot is cleared', async () => {
    enableGamePersistence(storeFile)
    await app.request('/game', jsonRequest('POST', { factions: ['marquise', 'eyrie'] }))
    expect(existsSync(storeFile)).toBe(true)

    await app.request('/game', { method: 'DELETE' })

    expect(existsSync(storeFile)).toBe(false)
  })

  it('forgets the saved game when the server is stopped', async () => {
    enableGamePersistence(storeFile)
    await app.request('/game', jsonRequest('POST', { factions: ['marquise', 'eyrie'] }))
    expect(existsSync(storeFile)).toBe(true)

    clearStoredGame()
    expect(existsSync(storeFile)).toBe(false)

    // Next start: nothing to restore.
    store.game = null
    enableGamePersistence(storeFile)
    expect(store.game).toBeNull()
  })

  it('saves every online room and brings each back with its players', async () => {
    enableGamePersistence(storeFile)
    await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }, HOST_PLAYER_ID))
    await app.request(
      '/game/join',
      jsonRequest('POST', { playerId: HOST_PLAYER_ID, faction: 'marquise' }, HOST_PLAYER_ID),
    )
    await app.request(
      '/game',
      jsonRequest('POST', { factions: [], mode: 'online' }, OTHER_HOST_PLAYER_ID),
    )
    const savedCodes: Array<string | null> = roomRegistry
      .rooms()
      .map((room: GameRoom): string | null => room.roomCode)

    // Simulate a server restart: every room wiped from memory, files kept.
    resetAllRooms()
    enableGamePersistence(storeFile)

    expect(
      roomRegistry.rooms().map((room: GameRoom): string | null => room.roomCode).sort(),
    ).toEqual([...savedCodes].sort())
    const hostRoom = roomRegistry.roomOfPlayer(HOST_PLAYER_ID)
    expect(hostRoom?.mode).toBe('online')
    expect(hostRoom?.game?.state.players[0]?.playerId).toBe(HOST_PLAYER_ID)
  })

  it('brings back the unseated creator and watchers of a room', async () => {
    enableGamePersistence(storeFile)
    await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }, HOST_PLAYER_ID))
    const roomCode: string = roomRegistry.roomOfPlayer(HOST_PLAYER_ID)?.roomCode ?? ''
    await app.request(`/game/rooms/${roomCode}/enter`, {
      method: 'POST',
      headers: { 'X-Player-Id': OTHER_HOST_PLAYER_ID },
    })

    resetAllRooms()
    enableGamePersistence(storeFile)

    const restoredRoom: GameRoom | null = roomRegistry.findRoom(roomCode)
    expect(restoredRoom?.creatorPlayerId).toBe(HOST_PLAYER_ID)
    expect(roomRegistry.roomOfPlayer(HOST_PLAYER_ID)).toBe(restoredRoom)
    expect(roomRegistry.roomOfPlayer(OTHER_HOST_PLAYER_ID)).toBe(restoredRoom)
  })

  it('a player listed in a finished room and an active one goes back to the active one', async () => {
    enableGamePersistence(storeFile)
    await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }, HOST_PLAYER_ID))
    const finishedRoom: GameRoom | null = roomRegistry.roomOfPlayer(HOST_PLAYER_ID)
    if (finishedRoom === null || finishedRoom.game === null) throw new Error('expected the first room')
    finishedRoom.game.state.status = 'finished'
    persistRoom(finishedRoom)
    await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }, HOST_PLAYER_ID))
    const activeRoomCode: string | null = roomRegistry.roomOfPlayer(HOST_PLAYER_ID)?.roomCode ?? null
    // File names decide the read order: put the finished room last.
    const roomsDirectory = path.join(path.dirname(storeFile), 'rooms')
    renameSync(
      path.join(roomsDirectory, `${finishedRoom.roomCode ?? ''}.json`),
      path.join(roomsDirectory, `${LAST_ROOM_CODE}.json`),
    )
    renameSync(
      path.join(roomsDirectory, `${activeRoomCode ?? ''}.json`),
      path.join(roomsDirectory, `${FIRST_ROOM_CODE}.json`),
    )

    resetAllRooms()
    enableGamePersistence(storeFile)

    expect(roomRegistry.roomOfPlayer(HOST_PLAYER_ID)?.roomCode).toBe(FIRST_ROOM_CODE)
  })

  it('an ended room loses its file; a stopped server forgets every room', async () => {
    enableGamePersistence(storeFile)
    await app.request('/game', jsonRequest('POST', { factions: [], mode: 'online' }, HOST_PLAYER_ID))
    await app.request(
      '/game',
      jsonRequest('POST', { factions: [], mode: 'online' }, OTHER_HOST_PLAYER_ID),
    )
    const roomsDirectory = path.join(path.dirname(storeFile), 'rooms')
    const hostRoomFile = path.join(
      roomsDirectory,
      `${roomRegistry.roomOfPlayer(HOST_PLAYER_ID)?.roomCode ?? ''}.json`,
    )
    expect(existsSync(hostRoomFile)).toBe(true)

    await app.request('/game', { method: 'DELETE', headers: { 'X-Player-Id': HOST_PLAYER_ID } })
    expect(existsSync(hostRoomFile)).toBe(false)

    clearStoredGame()
    expect(existsSync(roomsDirectory)).toBe(false)
  })

  it('writes nothing while persistence is off', async () => {
    await app.request('/game', jsonRequest('POST', { factions: ['marquise', 'eyrie'] }))
    expect(existsSync(storeFile)).toBe(false)
  })
})
