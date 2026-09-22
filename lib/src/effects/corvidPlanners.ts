import type { CardEffect } from '#triggers/effects.js'
import type { GameState } from '#state/types.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'

const CORVID_PLANNERS_DEF_ID = 'ROOT-64'

function hasCorvidPlanners(state: GameState, seat: Seat): boolean {
  return playerOf(state, seat).playArea.some((playCard) => playCard.defId === CORVID_PLANNERS_DEF_ID)
}

/** Rule: Cards > Craft — Corvid Planners: while moving, ignore rule. */
export const corvidPlannersEffect: CardEffect = {
  defId: CORVID_PLANNERS_DEF_ID,
  hooks: {
    needsRuleToMove(state, seat) {
      if (!hasCorvidPlanners(state, seat)) return undefined
      return false
    },
  },
}
