import type { RuleHooks } from '#triggers/hooks.js'
import { pilgrimRuler } from '#factions/lizard/rules.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'
import { ruleStrength } from '#queries/pieces.js'
import { isEyrieSeat } from '#queries/seat.js'

/** Rule: Board > Rule — most warriors + buildings; tie → none; Eyrie wins ties (Lords of the Forest). */
export function ruler(
  state: GameState,
  clearing: ClearingId,
  hooks: RuleHooks,
): Seat | null {
  if (clearing < 0 || clearing >= FALL.clearings.length) return null

  // Rule: 10.2.4 Pilgrims — gardens rule; overrides Lords of the Forest.
  const pilgrim = pilgrimRuler(state, clearing)
  if (pilgrim !== null) return pilgrim

  const strengths = new Map<Seat, number>()
  for (const player of state.players) {
    const s = ruleStrength(state, clearing, player.seat, hooks)
    if (s > 0) strengths.set(player.seat, s)
  }

  if (strengths.size === 0) return null

  let max = 0
  for (const s of strengths.values()) {
    if (s > max) max = s
  }

  const tied = [...strengths.entries()].filter(([, s]) => s === max).map(([seat]) => seat)
  if (tied.length === 1) return tied[0]!

  const eyrieTied = tied.filter((seat) => isEyrieSeat(state, seat))
  if (eyrieTied.length > 0) return eyrieTied.sort((a, b) => a - b)[0]!

  return null
}

export function rules(
  state: GameState,
  clearing: ClearingId,
  seat: Seat,
  hooks: RuleHooks,
): boolean {
  return ruler(state, clearing, hooks) === seat
}
