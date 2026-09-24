import type { BattleTargetChoice } from '#actions/types.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { warriors } from '#queries/pieces.js'
import type { GameState } from '#state/types.js'

export function canBattle(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
  defender: Seat,
): boolean {
  if (defender === seat) return false
  if (warriors(state, clearing, seat) < 1) return false
  return enemySeatsInClearing(state, clearing, seat).includes(defender)
}

export function legalBattleTargets(
  state: GameState,
  seat: Seat,
): BattleTargetChoice[] {
  const targets: BattleTargetChoice[] = []
  for (
    let clearing: ClearingId = 0;
    clearing < state.clearings.length;
    clearing++
  ) {
    for (const defender of enemySeatsInClearing(state, clearing, seat)) {
      if (canBattle(state, seat, clearing, defender)) {
        targets.push({ clearing, defender })
      }
    }
  }
  return targets
}
