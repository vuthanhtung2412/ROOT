import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { Game } from '@root/lib'
import { logGameEvent } from '#debug/logGame.js'
import {
  DEFAULT_AI_PLAYER_STATUS,
  DEFAULT_LOBBY_MODE,
  LOBBY_MODES,
  store,
  type AiPlayerSeat,
  type LobbyMode,
} from '#store/GameStore.js'
import { isGameSnapshot } from '#typeGuards.js'

const TEMPORARY_FILE_SUFFIX = '.tmp'

/** Null = persistence off (unit tests, or disabled by env). */
let persistenceFilePath: string | null = null

function isLobbyMode(value: unknown): value is LobbyMode {
  return LOBBY_MODES.some((mode) => mode === value)
}

/** What is saved of an AI seat: who and which model, not its live status. */
type StoredAiPlayerSeat = Pick<AiPlayerSeat, 'playerId' | 'model'>

function isStoredAiPlayerSeat(value: unknown): value is StoredAiPlayerSeat {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'playerId') === 'string' &&
    typeof Reflect.get(value, 'model') === 'string'
  )
}

function restoreAiPlayerSeats(value: unknown): AiPlayerSeat[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isStoredAiPlayerSeat).map(
    (seat: StoredAiPlayerSeat): AiPlayerSeat => ({
      playerId: seat.playerId,
      model: seat.model,
      status: DEFAULT_AI_PLAYER_STATUS,
    }),
  )
}

/**
 * Keep the game slot on disk so a server restart does not drop a running
 * game. Loads the stored slot (if any) into the store right away.
 */
export function enableGamePersistence(filePath: string): void {
  persistenceFilePath = filePath
  restoreStoredGame(filePath)
}

export function disableGamePersistence(): void {
  persistenceFilePath = null
}

function restoreStoredGame(filePath: string): void {
  if (!existsSync(filePath)) {
    return
  }
  try {
    const stored: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
    if (typeof stored !== 'object' || stored === null) {
      return
    }
    const snapshot: unknown = Reflect.get(stored, 'snapshot')
    const mode: unknown = Reflect.get(stored, 'mode')
    if (!isGameSnapshot(snapshot)) {
      return
    }
    const aiPlayers: unknown = Reflect.get(stored, 'aiPlayers')
    store.game = Game.fromJSON(snapshot)
    store.mode = isLobbyMode(mode) ? mode : DEFAULT_LOBBY_MODE
    store.aiPlayers = restoreAiPlayerSeats(aiPlayers)
    console.log(
      `Restored existing ${store.mode} game from ${filePath} ` +
        `(${store.aiPlayers.length} AI seats)`,
    )
    // Same full dump as after a loaded snapshot: seats, phase, boards, map.
    logGameEvent('LOAD', store.game.state)
  } catch (error: unknown) {
    console.error(`Could not restore game from ${filePath}`, error)
  }
}

/** Forget the saved slot, so the next start comes up with no game. */
export function clearStoredGame(): void {
  const filePath = persistenceFilePath
  if (filePath === null) {
    return
  }
  try {
    rmSync(filePath, { force: true })
  } catch (error: unknown) {
    console.error(`Could not clear stored game at ${filePath}`, error)
  }
}

/** Write the current slot (or remove the file when the slot is empty). */
export function persistCurrentGame(): void {
  const filePath = persistenceFilePath
  if (filePath === null) {
    return
  }
  try {
    if (store.game === null) {
      rmSync(filePath, { force: true })
      return
    }
    mkdirSync(path.dirname(filePath), { recursive: true })
    // Write then rename so a crash mid-write never leaves a broken file.
    const temporaryPath = `${filePath}${TEMPORARY_FILE_SUFFIX}`
    writeFileSync(
      temporaryPath,
      JSON.stringify({
        mode: store.mode,
        aiPlayers: store.aiPlayers.map(
          (seat: AiPlayerSeat): StoredAiPlayerSeat => ({
            playerId: seat.playerId,
            model: seat.model,
          }),
        ),
        snapshot: store.game.toJSON(),
      }),
      'utf8',
    )
    renameSync(temporaryPath, filePath)
  } catch (error: unknown) {
    console.error(`Could not persist game to ${filePath}`, error)
  }
}
