import { actionMatchesOption, type ActionOption } from '#actions/options.js'
import type { Action, ActionSpec } from '#actions/types.js'
import { Deck } from '#cards/Deck.js'
import type { CardEffect } from '#triggers/effects.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { Seat } from '#pieces/types.js'
import { canMove } from '#queries/move.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { moveWarriors } from '#rules/move.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import type { RuleHooks } from '#triggers/hooks.js'

const FALSE_ORDERS_DEF_ID = 'ROOT-72'
const CLEARING_COUNT: number = FALL.clearings.length

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
  return !state.turnScratch.falseOrdersUsed
}

/** Card text: the forced move is made "ignoring rule". */
function hooksIgnoringRule(hooks: RuleHooks): RuleHooks {
  return { ...hooks, needsRuleToMove: (): boolean => false }
}

/**
 * Every legal payload: enemy × clearing with their warriors × destination.
 * Rule: 1.5.5 Use of Force — the move is resolved as if the enemy chose it,
 * so the enemy's own adjacency applies (rivers with Boat Builders, …).
 */
function falseOrdersOptions(
  state: GameState,
  ownerSeat: Seat,
  hooks: RuleHooks,
): ActionOption[] {
  const forcedHooks: RuleHooks = hooksIgnoringRule(hooks)
  const options: ActionOption[] = []
  for (const enemy of state.players) {
    if (enemy.seat === ownerSeat) continue
    for (let from = 0; from < CLEARING_COUNT; from++) {
      if (warriors(state, from, enemy.seat) < 1) continue
      for (let to = 0; to < CLEARING_COUNT; to++) {
        if (to === from) continue
        if (!canMove(state, { seat: enemy.seat, from, to }, forcedHooks)) continue
        options.push({ target: enemy.seat, from, to })
      }
    }
  }
  return options
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
  // Check the forced move first: the card is only discarded for a legal one.
  if (
    !actionMatchesOption(action, falseOrdersOptions(state, ownerSeat, ctx.hooks))
  ) {
    throw new RuleError('INVALID_FALSE_ORDERS_MOVE', { action })
  }

  const available = warriors(state, action.from, action.target)
  const moveCount = Math.ceil(available / 2)

  const owner = playerOf(state, ownerSeat)
  const selfIndex = owner.playArea.findIndex((playCard) => playCard.defId === FALSE_ORDERS_DEF_ID)
  if (selfIndex < 0) throw new RuleError('FALSE_ORDERS_NOT_IN_PLAY')
  const selfCard = owner.playArea.splice(selfIndex, 1)[0]!
  Deck.discard(state.deck, selfCard, {
    onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
  })

  const forcedCtx: Ctx = { ...ctx, hooks: hooksIgnoringRule(ctx.hooks) }
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
  action: {
    types: ['falseOrders'],
    apply: tryApplyFalseOrders,
  },
  grants(state) {
    if (!falseOrdersAvailable(state)) return []
    const ownerSeat = falseOrdersOwner(state)
    if (ownerSeat === null) return []
    const options: ActionOption[] = falseOrdersOptions(
      state,
      ownerSeat,
      buildRuleHooks(state, FALL),
    )
    if (options.length === 0) return []
    const spec: ActionSpec = {
      type: 'falseOrders',
      actor: ownerSeat,
      params: { options },
    }
    return [spec]
  },
}
