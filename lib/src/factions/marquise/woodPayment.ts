import type { Ctx } from '#game/ctx.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { connectedRuled } from '#queries/connected.js'
import { ruleStrength } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import type { MarquiseBoard } from '#state/boards.js'
import type { GameState } from '#state/types.js'

function marquiseBoardOf(state: GameState, seat: Seat): MarquiseBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'marquise') throw new RuleError('NOT_MARQUISE', { seat })
  return board
}

/**
 * Rule strength of this seat minus the strongest other seat in the clearing.
 * Lower = more contested / thinner rule lead.
 */
export function controlMargin(
  state: GameState,
  clearing: ClearingId,
  seat: Seat,
  ctx: Ctx,
): number {
  const ownStrength = ruleStrength(state, clearing, seat, ctx.hooks)
  let strongestOther = 0
  for (const player of state.players) {
    if (player.seat === seat) continue
    const otherStrength = ruleStrength(state, clearing, player.seat, ctx.hooks)
    if (otherStrength > strongestOther) strongestOther = otherStrength
  }
  return ownStrength - strongestOther
}

/** One clearing id per owned wood token in the ruled chain from the build site. */
export function availableWoodClearings(
  state: GameState,
  seat: Seat,
  buildClearing: ClearingId,
  ctx: Ctx,
): ClearingId[] {
  const region = connectedRuled(state, seat, buildClearing, ctx.hooks)
  const clearings: ClearingId[] = []
  for (const clearing of [...region].sort((left, right) => left - right)) {
    for (const piece of state.clearings[clearing]!.pieces) {
      if (piece.kind === 'token' && piece.type === 'wood' && piece.owner === seat) {
        clearings.push(clearing)
      }
    }
  }
  return clearings
}

interface WoodSpendRequest {
  availableWoodClearings: readonly ClearingId[]
  amount: number
  /** Lower margin spent first (most contested wood). */
  marginForClearing: (clearing: ClearingId) => number
}

/**
 * Greedy wood spend: take from clearings with lowest
 * `ownControl − max(otherControl)` until `amount` tokens chosen.
 */
export function suggestWoodClearings(request: WoodSpendRequest): ClearingId[] {
  const { availableWoodClearings: available, amount, marginForClearing } = request
  if (amount <= 0) return []

  const woodCountByClearing = new Map<ClearingId, number>()
  for (const clearing of available) {
    woodCountByClearing.set(clearing, (woodCountByClearing.get(clearing) ?? 0) + 1)
  }

  const orderedClearings = [...woodCountByClearing.keys()].sort((left, right) => {
    const marginDelta = marginForClearing(left) - marginForClearing(right)
    if (marginDelta !== 0) return marginDelta
    return left - right
  })

  const chosen: ClearingId[] = []
  for (const clearing of orderedClearings) {
    const woodHere = woodCountByClearing.get(clearing) ?? 0
    for (let taken = 0; taken < woodHere && chosen.length < amount; taken++) {
      chosen.push(clearing)
    }
    if (chosen.length >= amount) break
  }
  return chosen
}

interface WoodPayment {
  seat: Seat
  buildClearing: ClearingId
  /** One clearing id per wood token to remove; length must equal the build cost. */
  woodClearings: readonly ClearingId[]
}

export function isValidWoodPayment(
  state: GameState,
  payment: WoodPayment,
  ctx: Ctx,
): boolean {
  const { seat, buildClearing, woodClearings } = payment
  const available = availableWoodClearings(state, seat, buildClearing, ctx)
  const availableCountByClearing = new Map<ClearingId, number>()
  for (const clearing of available) {
    availableCountByClearing.set(
      clearing,
      (availableCountByClearing.get(clearing) ?? 0) + 1,
    )
  }
  const spentCountByClearing = new Map<ClearingId, number>()
  for (const clearing of woodClearings) {
    spentCountByClearing.set(clearing, (spentCountByClearing.get(clearing) ?? 0) + 1)
  }
  for (const [clearing, spent] of spentCountByClearing) {
    if (spent > (availableCountByClearing.get(clearing) ?? 0)) return false
  }
  return true
}

/** Rule: 6.5.4.II — remove chosen wood tokens from the ruled chain. */
export function payWood(state: GameState, payment: WoodPayment, ctx: Ctx): void {
  const { seat, buildClearing, woodClearings } = payment
  if (woodClearings.length === 0) return
  if (!isValidWoodPayment(state, { seat, buildClearing, woodClearings }, ctx)) {
    throw new RuleError('NOT_ENOUGH_WOOD', {
      amount: woodClearings.length,
      woodClearings: [...woodClearings],
    })
  }
  const board = marquiseBoardOf(state, seat)
  const remainingByClearing = new Map<ClearingId, number>()
  for (const clearing of woodClearings) {
    remainingByClearing.set(clearing, (remainingByClearing.get(clearing) ?? 0) + 1)
  }
  for (const [clearing, count] of remainingByClearing) {
    let left = count
    const clearingState = state.clearings[clearing]!
    clearingState.pieces = clearingState.pieces.filter((piece) => {
      if (left <= 0) return true
      if (piece.kind === 'token' && piece.type === 'wood' && piece.owner === seat) {
        left -= 1
        board.supply.wood += 1
        return false
      }
      return true
    })
    if (left > 0) {
      throw new RuleError('NOT_ENOUGH_WOOD', { clearing, remaining: left })
    }
  }
}
