import { store } from '#store/GameStore.js'

const MILLISECONDS_PER_SECOND = 1000

export const DEFAULT_INACTIVE_GAME_TIMEOUT_SECONDS = 300

export type InactiveGameCleanupConfig = {
  inactivityTimeoutSeconds: number
  /** Empties the slot and tells every viewer. */
  clearGame: () => void
}

/** Null until the server starts the cleanup (unit tests of other modules). */
let cleanupConfig: InactiveGameCleanupConfig | null = null
let inactivityTimer: NodeJS.Timeout | null = null

/**
 * Every slot change counts as activity: a move, a join, an AI or bot step.
 * Restarts the countdown that clears the slot.
 */
export function recordGameActivity(): void {
  const config = cleanupConfig
  if (config === null) {
    return
  }
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer)
  }
  // unref: the countdown alone never keeps the process alive.
  inactivityTimer = setTimeout((): void => {
    inactivityTimer = null
    if (store.game !== null) {
      config.clearGame()
    }
  }, config.inactivityTimeoutSeconds * MILLISECONDS_PER_SECOND).unref()
}

/** Starts the countdown right away, so a game restored from disk is covered too. */
export function startInactiveGameCleanup(config: InactiveGameCleanupConfig): void {
  cleanupConfig = config
  recordGameActivity()
}
