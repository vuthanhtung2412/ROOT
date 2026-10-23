import type { Game } from '@root/lib'

/**
 * `hotseat`: one device plays every seat (local party, QA). No seat checks.
 * `online`: one browser per seat. Actions are checked against the caller's seat.
 */
export const LOBBY_MODES = ['hotseat', 'online'] as const

export type LobbyMode = (typeof LOBBY_MODES)[number]

export const DEFAULT_LOBBY_MODE: LobbyMode = 'hotseat'

/**
 * `thinking`: a session is running. `stuck`: its session failed and waits for
 * a restart. `idle`: nothing to decide.
 */
export const AI_PLAYER_STATUSES = ['idle', 'thinking', 'stuck'] as const

export type AiPlayerStatus = (typeof AI_PLAYER_STATUSES)[number]

export const DEFAULT_AI_PLAYER_STATUS: AiPlayerStatus = 'idle'

/** A seat played by an LLM. `playerId` is the join id the server made for it. */
export type AiPlayerSeat = {
  playerId: string
  /** `<provider>:<modelId>`. */
  model: string
  /** Live only: not saved, a restarted server starts every seat `idle`. */
  status: AiPlayerStatus
}

/** Online bot pace: seconds between two bot actions, slowest first (the pace button order). */
export const BOT_STEP_DELAY_SECONDS_CHOICES = [5, 2, 1] as const

export type BotStepDelaySeconds = (typeof BOT_STEP_DELAY_SECONDS_CHOICES)[number]

export const DEFAULT_BOT_STEP_DELAY_SECONDS: BotStepDelaySeconds = 5

/** The hotseat slot has no code: it is reached by callers outside every online room. */
export const HOTSEAT_ROOM_CODE: null = null

/** One game slot: the hotseat slot or an online room. */
export type GameRoom = {
  /** What players type to enter an online room; null for the hotseat slot. */
  readonly roomCode: string | null
  game: Game | null
  mode: LobbyMode
  /** AI seats of the current game. Replaced, never mutated in place. */
  aiPlayers: readonly AiPlayerSeat[]
  /** Online games: the wait between bot actions, set by the host. */
  botStepDelaySeconds: BotStepDelaySeconds
}

/** An empty slot: no game, every setting at its default. */
export function createGameRoom(roomCode: string | null): GameRoom {
  return {
    roomCode,
    game: null,
    mode: DEFAULT_LOBBY_MODE,
    aiPlayers: [],
    botStepDelaySeconds: DEFAULT_BOT_STEP_DELAY_SECONDS,
  }
}

/** The hotseat slot (local party, QA, CLI). */
export const store: GameRoom = createGameRoom(HOTSEAT_ROOM_CODE)

/** Empty the slot: no game, every setting back to its default. */
export function resetGameStore(): void {
  store.game = null
  store.mode = DEFAULT_LOBBY_MODE
  store.aiPlayers = []
  store.botStepDelaySeconds = DEFAULT_BOT_STEP_DELAY_SECONDS
}
