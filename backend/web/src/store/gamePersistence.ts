import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { Game } from '@root/lib'
import { logGameEvent } from '#debug/logGame.js'
import {
  BOT_STEP_DELAY_SECONDS_CHOICES,
  createGameRoom,
  DEFAULT_AI_PLAYER_STATUS,
  DEFAULT_BOT_STEP_DELAY_SECONDS,
  DEFAULT_LOBBY_MODE,
  LOBBY_MODES,
  store,
  type AiPlayerSeat,
  type BotStepDelaySeconds,
  type GameRoom,
  type LobbyMode,
} from '#store/GameStore.js'
import { recordGameActivity } from '#store/inactiveGameCleanup.js'
import { roomRegistry } from '#store/roomRegistry.js'
import { isGameSnapshot } from '#typeGuards.js'

const TEMPORARY_FILE_SUFFIX = '.tmp'
const ROOM_FILE_EXTENSION = '.json'
/** Online rooms live next to the hotseat file, one file per room code. */
const ROOMS_DIRECTORY_NAME = 'rooms'

/** Null = persistence off (unit tests, or disabled by env). */
let persistenceFilePath: string | null = null

function isLobbyMode(value: unknown): value is LobbyMode {
  return LOBBY_MODES.some((mode) => mode === value)
}

function isBotStepDelaySeconds(value: unknown): value is BotStepDelaySeconds {
  return BOT_STEP_DELAY_SECONDS_CHOICES.some((seconds: BotStepDelaySeconds): boolean => seconds === value)
}

/** What is saved of an AI seat: who and which model, not its live status. */
type StoredAiPlayerSeat = Pick<AiPlayerSeat, 'playerId' | 'model'>

/** A slot read back from disk. */
type StoredSlot = Pick<GameRoom, 'mode' | 'aiPlayers' | 'botStepDelaySeconds'> & {
  game: Game
}

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

function roomsDirectoryOf(hotseatFilePath: string): string {
  return path.join(path.dirname(hotseatFilePath), ROOMS_DIRECTORY_NAME)
}

/** The file a room is saved in; null while persistence is off. */
function fileOfRoom(room: GameRoom): string | null {
  const filePath = persistenceFilePath
  if (filePath === null) {
    return null
  }
  if (room.roomCode === null) {
    return filePath
  }
  return path.join(roomsDirectoryOf(filePath), `${room.roomCode}${ROOM_FILE_EXTENSION}`)
}

/**
 * Keep every slot on disk so a server restart does not drop a running game.
 * Loads the stored hotseat slot and online rooms right away.
 */
export function enableGamePersistence(filePath: string): void {
  persistenceFilePath = filePath
  restoreHotseatSlot(filePath)
  restoreOnlineRooms(roomsDirectoryOf(filePath))
}

export function disableGamePersistence(): void {
  persistenceFilePath = null
}

function readStoredSlot(filePath: string): StoredSlot | null {
  try {
    const stored: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
    if (typeof stored !== 'object' || stored === null) {
      return null
    }
    const snapshot: unknown = Reflect.get(stored, 'snapshot')
    if (!isGameSnapshot(snapshot)) {
      return null
    }
    const mode: unknown = Reflect.get(stored, 'mode')
    const botStepDelaySeconds: unknown = Reflect.get(stored, 'botStepDelaySeconds')
    return {
      game: Game.fromJSON(snapshot),
      mode: isLobbyMode(mode) ? mode : DEFAULT_LOBBY_MODE,
      aiPlayers: restoreAiPlayerSeats(Reflect.get(stored, 'aiPlayers')),
      botStepDelaySeconds: isBotStepDelaySeconds(botStepDelaySeconds)
        ? botStepDelaySeconds
        : DEFAULT_BOT_STEP_DELAY_SECONDS,
    }
  } catch (error: unknown) {
    console.error(`Could not restore game from ${filePath}`, error)
    return null
  }
}

function reportRestoredSlot(slot: StoredSlot, filePath: string): void {
  console.log(
    `Restored existing ${slot.mode} game from ${filePath} ` +
      `(${slot.aiPlayers.length} AI seats)`,
  )
  // Same full dump as after a loaded snapshot: seats, phase, boards, map.
  logGameEvent('LOAD', slot.game.state)
}

function restoreHotseatSlot(filePath: string): void {
  if (!existsSync(filePath)) {
    return
  }
  const slot: StoredSlot | null = readStoredSlot(filePath)
  if (slot === null) {
    return
  }
  store.game = slot.game
  store.mode = slot.mode
  store.aiPlayers = slot.aiPlayers
  store.botStepDelaySeconds = slot.botStepDelaySeconds
  reportRestoredSlot(slot, filePath)
}

/** Every saved room comes back under its code, with its seated players in it. */
function restoreOnlineRooms(roomsDirectory: string): void {
  if (!existsSync(roomsDirectory)) {
    return
  }
  const fileNames: string[] = readdirSync(roomsDirectory).filter(
    (fileName: string): boolean => fileName.endsWith(ROOM_FILE_EXTENSION),
  )
  for (const fileName of fileNames) {
    const filePath = path.join(roomsDirectory, fileName)
    const slot: StoredSlot | null = readStoredSlot(filePath)
    if (slot === null) {
      continue
    }
    const roomCode: string = path.basename(fileName, ROOM_FILE_EXTENSION)
    const room: GameRoom = { ...createGameRoom(roomCode), ...slot }
    roomRegistry.restoreRoom(room)
    for (const player of slot.game.state.players) {
      roomRegistry.addMember(room, player.playerId)
    }
    reportRestoredSlot(slot, filePath)
  }
}

/** Forget every saved slot, so the next start comes up with no game. */
export function clearStoredGame(): void {
  const filePath = persistenceFilePath
  if (filePath === null) {
    return
  }
  try {
    rmSync(filePath, { force: true })
    rmSync(roomsDirectoryOf(filePath), { recursive: true, force: true })
  } catch (error: unknown) {
    console.error(`Could not clear stored game at ${filePath}`, error)
  }
}

/** Write the room (or remove its file when the room is empty). */
export function persistRoom(room: GameRoom): void {
  // Every slot change is saved here, so it is also where activity is seen.
  recordGameActivity(room)
  const filePath = fileOfRoom(room)
  if (filePath === null) {
    return
  }
  try {
    if (room.game === null) {
      rmSync(filePath, { force: true })
      return
    }
    mkdirSync(path.dirname(filePath), { recursive: true })
    // Write then rename so a crash mid-write never leaves a broken file.
    const temporaryPath = `${filePath}${TEMPORARY_FILE_SUFFIX}`
    writeFileSync(
      temporaryPath,
      JSON.stringify({
        mode: room.mode,
        botStepDelaySeconds: room.botStepDelaySeconds,
        aiPlayers: room.aiPlayers.map(
          (seat: AiPlayerSeat): StoredAiPlayerSeat => ({
            playerId: seat.playerId,
            model: seat.model,
          }),
        ),
        snapshot: room.game.toJSON(),
      }),
      'utf8',
    )
    renameSync(temporaryPath, filePath)
  } catch (error: unknown) {
    console.error(`Could not persist game to ${filePath}`, error)
  }
}
