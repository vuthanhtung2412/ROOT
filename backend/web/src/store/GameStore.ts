import type { Game } from '@root/lib'

/**
 * `hotseat`: one device plays every seat (local party, QA). No seat checks.
 * `online`: one browser per seat. Actions are checked against the caller's seat.
 */
export const LOBBY_MODES = ['hotseat', 'online'] as const

export type LobbyMode = (typeof LOBBY_MODES)[number]

export const DEFAULT_LOBBY_MODE: LobbyMode = 'hotseat'

export type GameStore = {
  game: Game | null
  mode: LobbyMode
}

export const store: GameStore = { game: null, mode: DEFAULT_LOBBY_MODE }
