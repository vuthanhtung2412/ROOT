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

export type GameStore = {
  game: Game | null
  mode: LobbyMode
  /** AI seats of the current game. Replaced, never mutated in place. */
  aiPlayers: readonly AiPlayerSeat[]
}

export const store: GameStore = {
  game: null,
  mode: DEFAULT_LOBBY_MODE,
  aiPlayers: [],
}
