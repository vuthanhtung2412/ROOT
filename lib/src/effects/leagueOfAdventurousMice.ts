import type { Action, ActionSpec, MarchMove } from '#actions/types.js'
import type { CardEffect } from '#triggers/effects.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { canMove } from '#queries/move.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { openBattle } from '#events/battle.js'
import { moveWarriors } from '#rules/move.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { Seat } from '#pieces/types.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import type { ClearingId } from '#map/types.js'

const LEAGUE_DEF_ID = 'ROOT-81'

function leagueOwner(state: GameState): Seat | null {
  for (const player of state.players) {
    if (player.playArea.some((playCard) => playCard.defId === LEAGUE_DEF_ID)) {
      return player.seat
    }
  }
  return null
}

function readyCraftedItemIndexes(state: GameState, seat: Seat): number[] {
  const indexes: number[] = []
  playerOf(state, seat).craftedItems.forEach((item, index) => {
    if (!item.exhausted) indexes.push(index)
  })
  return indexes
}

function leagueAvailable(state: GameState): boolean {
  const ownerSeat = leagueOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) return false
  if (state.phase !== 'daylight') return false
  if (state.turnScratch.leagueUsed) return false
  return readyCraftedItemIndexes(state, ownerSeat).length > 0
}

function legalLeagueMoves(state: GameState, seat: Seat): MarchMove[] {
  const hooks = buildRuleHooks(state, FALL)
  const moves: MarchMove[] = []
  for (let from = 0; from < 12; from++) {
    const available = warriors(state, from, seat)
    if (available < 1) continue
    for (let to = 0; to < 12; to++) {
      if (!canMove(state, { seat, from, to }, hooks)) continue
      for (let count = 1; count <= available; count++) {
        moves.push({ from, to, count })
      }
    }
  }
  return moves
}

function legalLeagueBattles(
  state: GameState,
  seat: Seat,
): Array<{ clearing: ClearingId; defender: Seat }> {
  const targets: Array<{ clearing: ClearingId; defender: Seat }> = []
  for (let clearing = 0; clearing < 12; clearing++) {
    if (warriors(state, clearing, seat) < 1) continue
    for (const defender of enemySeatsInClearing(state, clearing, seat)) {
      targets.push({ clearing, defender })
    }
  }
  return targets
}

function exhaustCraftedItem(state: GameState, seat: Seat, itemIndex: number): void {
  const item = playerOf(state, seat).craftedItems[itemIndex]
  if (!item || item.exhausted) {
    throw new RuleError('ITEM_NOT_AVAILABLE', { itemIndex })
  }
  item.exhausted = true
}

/** Rule: Cards > Craft — League: exhaust crafted item → one move or battle. */
export function tryApplyLeague(state: GameState, action: Action, ctx: Ctx): boolean {
  if (action.type !== 'leagueMove' && action.type !== 'leagueBattle') return false
  const ownerSeat = leagueOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }
  if (state.phase !== 'daylight') throw new RuleError('WRONG_PHASE', { phase: state.phase })
  if (state.turnScratch.leagueUsed) throw new RuleError('LEAGUE_USED')

  exhaustCraftedItem(state, ownerSeat, action.itemIndex)
  state.turnScratch.leagueUsed = true

  if (action.type === 'leagueMove') {
    moveWarriors(
      state,
      {
        seat: ownerSeat,
        from: action.from,
        to: action.to,
        count: action.count,
      },
      ctx,
    )
    return true
  }

  openBattle(
    state,
    {
      clearing: action.clearing,
      attacker: ownerSeat,
      defender: action.defender,
    },
    ctx,
  )
  return true
}

export const leagueOfAdventurousMiceEffect: CardEffect = {
  defId: LEAGUE_DEF_ID,
  grants(state) {
    if (!leagueAvailable(state)) return []
    const ownerSeat = leagueOwner(state)
    if (ownerSeat === null) return []
    const specs: ActionSpec[] = []
    if (legalLeagueMoves(state, ownerSeat).length > 0) {
      specs.push({ type: 'leagueMove', actor: ownerSeat })
    }
    if (legalLeagueBattles(state, ownerSeat).length > 0) {
      specs.push({ type: 'leagueBattle', actor: ownerSeat })
    }
    return specs
  },
}
