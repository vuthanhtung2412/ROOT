import {
  baseFactionOf,
  isBotFaction,
  type FactionId,
  type GameState,
  type PlayerState,
} from '@root/lib'
import { HttpError } from '#middleware/errors.js'

/** Free-for-all: every player for themselves. Cooperative: humans against bots (Rootbotics 3.5.1). */
export const PLAY_MODES = ['freeForAll', 'cooperative'] as const

export type PlayMode = (typeof PLAY_MODES)[number]

/** Rule: Rootbotics 3.5.1 — the Woodland is a team: one human is not enough. */
export const MINIMUM_COOPERATIVE_HUMANS = 2
export const MINIMUM_COOPERATIVE_BOTS = 1

export function playModeOf(state: GameState): PlayMode {
  return state.cooperative === true ? 'cooperative' : 'freeForAll'
}

function isBotPlayer(player: PlayerState): boolean {
  return isBotFaction(player.faction)
}

/**
 * Rule: Rootbotics 3.2 — a bot and the faction it replaces never sit
 * together. `playerId` may already sit at the table and pick again.
 */
export function requireNoTwinClash(
  state: GameState,
  seating: { playerId: string; faction: FactionId },
): void {
  const clash = state.players.find(
    (player: PlayerState): boolean =>
      player.playerId !== seating.playerId &&
      player.faction !== seating.faction &&
      baseFactionOf(player.faction) === baseFactionOf(seating.faction),
  )
  if (clash !== undefined) {
    throw new HttpError(400, 'FACTION_CLASH', {
      faction: seating.faction,
      seatedFaction: clash.faction,
    })
  }
}

/** Co-op start gate: two humans and a bot at least. */
export function requireCooperativeStart(state: GameState): void {
  if (state.cooperative !== true) return
  const botCount = state.players.filter(isBotPlayer).length
  const humanCount = state.players.length - botCount
  if (humanCount < MINIMUM_COOPERATIVE_HUMANS) {
    throw new HttpError(400, 'NOT_ENOUGH_HUMANS', {
      count: humanCount,
      minimum: MINIMUM_COOPERATIVE_HUMANS,
    })
  }
  if (botCount < MINIMUM_COOPERATIVE_BOTS) {
    throw new HttpError(400, 'NO_BOT', { minimum: MINIMUM_COOPERATIVE_BOTS })
  }
}
