import type { CardEffect } from '../triggers/effects.js'
import { FALL } from '../map/fall.js'
import { playerOf } from '../queries/seat.js'

function hasBoatBuilders(state: import('../state/types.js').GameState, seat: import('../pieces/types.js').Seat): boolean {
  return playerOf(state, seat).playArea.some((c) => c.defId === 'ROOT-57')
}

function riverAdjacent(a: number, b: number): boolean {
  return FALL.rivers.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

export const boatBuildersEffect: CardEffect = {
  defId: 'ROOT-57',
  hooks: {
    isAdjacent(state, seat, a, b) {
      if (!hasBoatBuilders(state, seat)) return false
      return riverAdjacent(a, b)
    },
  },
}
