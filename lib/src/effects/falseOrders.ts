import type { Action, ActionSpec } from '../actions/types.js'
import { Deck } from '../cards/Deck.js'
import type { CardEffect } from '../triggers/effects.js'
import type { Ctx } from '../game/ctx.js'
import { FALL } from '../map/fall.js'
import type { Seat } from '../pieces/types.js'
import { warriors } from '../queries/pieces.js'
import { playerOf } from '../queries/seat.js'
import { moveWarriors } from '../rules/move.js'
import { RuleError } from '../rules/RuleError.js'
import type { GameState } from '../state/types.js'

const FALSE_ORDERS_DEF_ID = 'ROOT-72'

function falseOrdersOwner(state: GameState): Seat | null {
  for (const player of state.players) {
    if (player.playArea.some((playCard) => playCard.defId === FALSE_ORDERS_DEF_ID)) {
      return player.seat
    }
  }
  return null
}

function falseOrdersAvailable(state: GameState): boolean {
  const ownerSeat = falseOrdersOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) return false
  if (state.phase !== 'birdsong') return false
  if (state.turnScratch.falseOrdersUsed) return false
  for (const player of state.players) {
    if (player.seat === ownerSeat) continue
    for (let clearing = 0; clearing < 12; clearing++) {
      if (warriors(state, clearing, player.seat) > 0) return true
    }
  }
  return false
}

/** Rule: Cards > Craft — False Orders: discard self → force half enemy warriors move, ignore rule. */
export function tryApplyFalseOrders(state: GameState, action: Action, ctx: Ctx): boolean {
  if (action.type !== 'falseOrders') return false
  const ownerSeat = falseOrdersOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }
  if (state.phase !== 'birdsong') throw new RuleError('WRONG_PHASE', { phase: state.phase })
  if (state.turnScratch.falseOrdersUsed) throw new RuleError('FALSE_ORDERS_USED')
  if (action.target === ownerSeat) throw new RuleError('INVALID_FALSE_ORDERS_TARGET')
  if (action.from === action.to) throw new RuleError('INVALID_FALSE_ORDERS_PATH')
  if (!FALL.isAdjacent(action.from, action.to)) {
    throw new RuleError('NOT_ADJACENT', { from: action.from, to: action.to })
  }

  const available = warriors(state, action.from, action.target)
  if (available < 1) throw new RuleError('NO_WARRIORS', { clearing: action.from })
  const moveCount = Math.ceil(available / 2)

  const owner = playerOf(state, ownerSeat)
  const selfIndex = owner.playArea.findIndex((playCard) => playCard.defId === FALSE_ORDERS_DEF_ID)
  if (selfIndex < 0) throw new RuleError('FALSE_ORDERS_NOT_IN_PLAY')
  const selfCard = owner.playArea.splice(selfIndex, 1)[0]!
  Deck.discard(state.deck, selfCard, {
    onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
  })

  const ignoreRuleHooks = {
    ...ctx.hooks,
    needsRuleToMove: () => false,
  }
  const forcedCtx: Ctx = { ...ctx, hooks: ignoreRuleHooks }
  moveWarriors(
    state,
    { seat: action.target, from: action.from, to: action.to, count: moveCount },
    forcedCtx,
  )

  state.turnScratch.falseOrdersUsed = true
  return true
}

export const falseOrdersEffect: CardEffect = {
  defId: FALSE_ORDERS_DEF_ID,
  grants(state) {
    if (!falseOrdersAvailable(state)) return []
    const ownerSeat = falseOrdersOwner(state)
    if (ownerSeat === null) return []
    return [{ type: 'falseOrders', actor: ownerSeat }]
  },
}
