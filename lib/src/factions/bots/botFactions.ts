import type { Seat } from '#pieces/types.js'
import {
  isBotFaction,
  type BotFactionId,
} from '#public/botFactionIds.js'
import { factionOf } from '#queries/seat.js'
import type { GameState, PlayerState } from '#state/types.js'

export {
  BOT_FACTION_IDS,
  artFactionOf,
  baseFactionOf,
  isBotFaction,
  type BotFactionId,
  type HumanFactionId,
} from '#public/botFactionIds.js'

/** Player id a bot seat joins with. Bots need no human (Rootbotics 2.6). */
export const BOT_PLAYER_ID_PREFIX = 'bot-'

export function isBotSeat(state: GameState, seat: Seat): boolean {
  return isBotFaction(factionOf(state, seat))
}

export function isHumanPlayer(player: PlayerState): boolean {
  return !isBotFaction(player.faction)
}

export function botPlayerIdFor(faction: BotFactionId): string {
  return `${BOT_PLAYER_ID_PREFIX}${faction}`
}
