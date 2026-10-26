import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import {
  attackerExtraHits,
  damageItems,
  maximumRolledHits,
  undamagedItems,
} from '#factions/bots/vagabot/items.js'
import type { BattleEvent } from '#events/types.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { factionOf } from '#queries/seat.js'
import type { GameState } from '#state/types.js'

export type VagabotHits = {
  victim: Seat
  hits: number
}

export function isVagabotSeat(state: GameState, seat: Seat): boolean {
  return factionOf(state, seat) === 'vagabot'
}

/** Rule: Rootbotics 7.2.4 — the Vagabot's maximum rolled hits. */
export function vagabotHitCap(state: GameState, seat: Seat): number {
  return maximumRolledHits(vagabotBoardOf(state, seat))
}

/** Battle 3 — the Vagabot with no undamaged item is defenseless (reading, see PLAN.md). */
export function isVagabotDefenseless(state: GameState, seat: Seat): boolean {
  return undamagedItems(vagabotBoardOf(state, seat)).length === 0
}

/** Rule: Rootbotics 7.2.4 — twelve items: one extra hit as attacker. */
export function vagabotAttackerExtraHits(state: GameState, event: BattleEvent): number {
  if (!isVagabotSeat(state, event.attacker)) return 0
  return attackerExtraHits(vagabotBoardOf(state, event.attacker))
}

/** Rule: Rootbotics 7.2.5 — hits damage items; the pawn never leaves the map. */
export function vagabotTakesHits(state: GameState, taken: VagabotHits): LogEntry[] {
  damageItems(vagabotBoardOf(state, taken.victim), taken.hits)
  return [
    {
      t: 'action',
      actor: taken.victim,
      action: { type: 'resolveEvent', decline: true },
    },
  ]
}
