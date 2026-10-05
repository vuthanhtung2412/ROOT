import type { ActionSpec } from '#api/client.ts'
import { readChoiceParams } from '#game/resolution/ActionComposer.ts'

export const REARRANGE_ACTION_TYPE = 'vbRearrange'

/** Where the item sits before the move. */
export type RearrangeOrigin = 'track' | 'satchel'

export interface RearrangeMove {
  seat: number
  itemType: string
  from: RearrangeOrigin
}

/**
 * Rule: 9.2.5.III — legal spec moving this item between its track and the
 * Satchel, or null when the engine does not offer that move.
 */
export function findRearrangeSpec(
  actions: readonly ActionSpec[],
  move: RearrangeMove,
): ActionSpec | null {
  for (const spec of actions) {
    if (spec.type !== REARRANGE_ACTION_TYPE || spec.actor !== move.seat) {
      continue
    }
    const params = readChoiceParams(spec)
    if (
      params.itemTypes?.[0] === move.itemType &&
      params.rearrangeFrom?.[0] === move.from
    ) {
      return spec
    }
  }
  return null
}
