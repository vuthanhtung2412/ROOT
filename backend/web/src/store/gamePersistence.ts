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
import {
  DEFAULT_LOBBY_MODE,
  LOBBY_MODES,
  store,
  type LobbyMode,
} from '#store/GameStore.js'
import { isGameSnapshot } from '#typeGuards.js'

const TEMPORARY_FILE_SUFFIX = '.tmp'

/** Null = persistence off (unit tests, or disabled by env). */
let persistenceFilePath: string | null = null

function isLobbyMode(value: unknown): value is LobbyMode {
  return LOBBY_MODES.some((mode) => mode === value)
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
    store.game = Game.fromJSON(snapshot)
    store.mode = isLobbyMode(mode) ? mode : DEFAULT_LOBBY_MODE
    console.log(`Restored ${store.mode} game from ${filePath}`)
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
      JSON.stringify({ mode: store.mode, snapshot: store.game.toJSON() }),
      'utf8',
    )
    renameSync(temporaryPath, filePath)
  } catch (error: unknown) {
    console.error(`Could not persist game to ${filePath}`, error)
  }
}
