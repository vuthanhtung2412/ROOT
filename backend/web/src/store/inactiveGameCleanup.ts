import { store, type GameRoom } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'

const MILLISECONDS_PER_SECOND = 1000

export const DEFAULT_INACTIVE_GAME_TIMEOUT_SECONDS = 300

export type InactiveGameCleanupConfig = {
  inactivityTimeoutSeconds: number
  /** Empties the room (online rooms end) and tells its viewers. */
  clearGame: (room: GameRoom) => void
}

/** Null until the server starts the cleanup (unit tests of other modules). */
let cleanupConfig: InactiveGameCleanupConfig | null = null
/** One countdown per room: a quiet room never clears a busy one. */
const inactivityTimersByRoom = new Map<GameRoom, NodeJS.Timeout>()

/**
 * Every change of a room counts as activity there: a move, a join, an AI or
 * bot step. Restarts that room's countdown.
 */
export function recordGameActivity(room: GameRoom): void {
  const config = cleanupConfig
  if (config === null) {
    return
  }
  const runningTimer = inactivityTimersByRoom.get(room)
  if (runningTimer !== undefined) {
    clearTimeout(runningTimer)
  }
  // unref: the countdown alone never keeps the process alive.
  const timer: NodeJS.Timeout = setTimeout((): void => {
    inactivityTimersByRoom.delete(room)
    if (room.game !== null) {
      config.clearGame(room)
    }
  }, config.inactivityTimeoutSeconds * MILLISECONDS_PER_SECOND).unref()
  inactivityTimersByRoom.set(room, timer)
}

/** Starts every countdown right away, so games restored from disk are covered too. */
export function startInactiveGameCleanup(config: InactiveGameCleanupConfig): void {
  cleanupConfig = config
  for (const room of [store, ...roomRegistry.rooms()]) {
    recordGameActivity(room)
  }
}
