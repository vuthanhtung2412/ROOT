import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import {
  VAGABOND_ALLIED_STEP,
  type VagabondBoard,
} from '#state/boards.js'
import type { GameState } from '#state/types.js'
import { boardOf } from '#factions/vagabond/items.js'

/** Rule: 9.2.9.II — relationship marker on final Allied space. */
export function isAlliedWith(
  board: VagabondBoard,
  factionSeat: Seat,
  state: GameState,
): boolean {
  const faction = playerOf(state, factionSeat).faction
  return board.relationships[faction] === VAGABOND_ALLIED_STEP
}

/** Allied factions with ≥1 warrior in clearing (for escort / battle-as-own). */
export function alliedWarriorSeatsInClearing(
  state: GameState,
  vagabondSeat: Seat,
  clearing: ClearingId,
): Seat[] {
  const board = boardOf(state, vagabondSeat)
  const seats: Seat[] = []
  for (const player of state.players) {
    if (player.seat === vagabondSeat) continue
    if (!isAlliedWith(board, player.seat, state)) continue
    if (warriors(state, clearing, player.seat) < 1) continue
    seats.push(player.seat)
  }
  return seats
}
