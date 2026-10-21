import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import type {
  ElectricEyrieBoard,
  MechanicalMarquiseBoard,
} from '#state/botBoards.js'
import type { GameState } from '#state/types.js'

export function mechanicalMarquiseBoardOf(
  state: GameState,
  seat: Seat,
): MechanicalMarquiseBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'mechanicalMarquise') {
    throw new RuleError('NOT_MECHANICAL_MARQUISE', { seat })
  }
  return board
}

export function electricEyrieBoardOf(
  state: GameState,
  seat: Seat,
): ElectricEyrieBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'electricEyrie') {
    throw new RuleError('NOT_ELECTRIC_EYRIE', { seat })
  }
  return board
}
