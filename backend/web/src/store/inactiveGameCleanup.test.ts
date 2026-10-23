import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStartedTwoPlayerGame } from '#test/gameStateFixtures.js'
import {
  recordGameActivity,
  startInactiveGameCleanup,
  type InactiveGameCleanupConfig,
} from '#store/inactiveGameCleanup.js'
import { resetGameStore, store, type GameRoom } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'
import { resetAllRooms } from '#test/roomFixtures.js'

const TIMEOUT_SECONDS = 300
const MILLISECONDS_PER_SECOND = 1000
const TIMEOUT_MILLISECONDS = TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND
const ONE_MILLISECOND = 1

function clearRoom(room: GameRoom): void {
  if (room === store) {
    resetGameStore()
    return
  }
  room.game = null
  roomRegistry.removeRoom(room)
}

function createCleanupConfig(): InactiveGameCleanupConfig {
  return {
    inactivityTimeoutSeconds: TIMEOUT_SECONDS,
    clearGame: vi.fn(clearRoom),
  }
}

describe('inactive game cleanup', () => {
  beforeEach((): void => {
    vi.useFakeTimers()
  })

  afterEach((): void => {
    vi.clearAllTimers()
    resetAllRooms()
    vi.useRealTimers()
  })

  it('keeps a game until the whole timeout has passed', () => {
    store.game = createStartedTwoPlayerGame()
    const cleanupConfig = createCleanupConfig()
    startInactiveGameCleanup(cleanupConfig)

    vi.advanceTimersByTime(TIMEOUT_MILLISECONDS - ONE_MILLISECOND)

    expect(cleanupConfig.clearGame).not.toHaveBeenCalled()
    expect(store.game).not.toBeNull()
  })

  it('clears a game untouched for the whole timeout', () => {
    store.game = createStartedTwoPlayerGame()
    const cleanupConfig = createCleanupConfig()
    startInactiveGameCleanup(cleanupConfig)

    vi.advanceTimersByTime(TIMEOUT_MILLISECONDS)

    expect(cleanupConfig.clearGame).toHaveBeenCalledExactlyOnceWith(store)
    expect(store.game).toBeNull()
  })

  it('new activity restarts the countdown', () => {
    store.game = createStartedTwoPlayerGame()
    const cleanupConfig = createCleanupConfig()
    startInactiveGameCleanup(cleanupConfig)

    vi.advanceTimersByTime(TIMEOUT_MILLISECONDS - ONE_MILLISECOND)
    recordGameActivity(store)
    vi.advanceTimersByTime(TIMEOUT_MILLISECONDS - ONE_MILLISECOND)

    expect(cleanupConfig.clearGame).not.toHaveBeenCalled()
    vi.advanceTimersByTime(ONE_MILLISECOND)
    expect(cleanupConfig.clearGame).toHaveBeenCalledOnce()
  })

  it('does nothing when the slot is already empty', () => {
    const cleanupConfig = createCleanupConfig()
    startInactiveGameCleanup(cleanupConfig)

    vi.advanceTimersByTime(TIMEOUT_MILLISECONDS)

    expect(cleanupConfig.clearGame).not.toHaveBeenCalled()
  })

  it('an idle room ends while a busy one keeps going', () => {
    const idleRoom: GameRoom = roomRegistry.createRoom()
    const busyRoom: GameRoom = roomRegistry.createRoom()
    idleRoom.game = createStartedTwoPlayerGame()
    busyRoom.game = createStartedTwoPlayerGame()
    const cleanupConfig = createCleanupConfig()
    startInactiveGameCleanup(cleanupConfig)

    vi.advanceTimersByTime(TIMEOUT_MILLISECONDS - ONE_MILLISECOND)
    recordGameActivity(busyRoom)
    vi.advanceTimersByTime(ONE_MILLISECOND)

    expect(cleanupConfig.clearGame).toHaveBeenCalledExactlyOnceWith(idleRoom)
    expect(roomRegistry.rooms()).toEqual([busyRoom])
    expect(busyRoom.game).not.toBeNull()
  })
})
