import type { ActionOption } from '#actions/options.js'
import type { Action, ActionSpec } from '#actions/types.js'
import type { Card } from '#cards/types.js'
import type { CardEffect } from '#triggers/effects.js'
import type { Ctx } from '#game/ctx.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import { randomIndex } from '#rules/Rng.js'
import type { GameState } from '#state/types.js'
import type { Seat } from '#pieces/types.js'

const DEF_ID = 'ROOT-103'

function swapMeetOwner(state: GameState): Seat | null {
  for (const player of state.players) {
    if (player.playArea.some((c) => c.defId === DEF_ID)) return player.seat
  }
  return null
}

/** Every legal payload: another player who holds at least one card. */
function swapMeetOptions(state: GameState, owner: Seat): ActionOption[] {
  const options: ActionOption[] = []
  for (const other of state.players) {
    if (other.seat === owner || other.hand.length < 1) continue
    options.push({ target: other.seat })
  }
  return options
}

/**
 * Card text: "Once in Birdsong, may take a random card from another player and
 * then give them a card." The card is taken here; which card to give is asked
 * next (`swapMeetGive`), once the taken card is known.
 */
export function tryApplySwapMeet(
  state: GameState,
  action: Action,
  ctx: Ctx,
): boolean {
  if (action.type !== 'swapMeet') return false
  const owner = swapMeetOwner(state)
  if (owner === null || owner !== state.currentSeat) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }
  if (state.phase !== 'birdsong') throw new RuleError('WRONG_PHASE', { phase: state.phase })
  if (state.turnScratch.swapMeetUsed) throw new RuleError('SWAP_MEET_USED')

  const target = playerOf(state, action.target)
  if (target.seat === owner) throw new RuleError('INVALID_SWAP_TARGET')
  if (target.hand.length < 1) throw new RuleError('TARGET_HAND_EMPTY')

  const takeIdx =
    target.hand.length === 1 ? 0 : randomIndex(ctx.rng, target.hand.length)
  const taken: Card = target.hand.splice(takeIdx, 1)[0]!
  playerOf(state, owner).hand.push(taken)
  state.pending.push({ type: 'swapMeetGive', seat: owner, target: target.seat })
  state.turnScratch.swapMeetUsed = true
  return true
}

export const swapMeetEffect: CardEffect = {
  defId: DEF_ID,
  action: {
    types: ['swapMeet'],
    apply: tryApplySwapMeet,
  },
  grants(state) {
    if (state.phase !== 'birdsong') return []
    if (state.turnScratch.swapMeetUsed) return []
    const owner = swapMeetOwner(state)
    if (owner === null || owner !== state.currentSeat) return []

    const options: ActionOption[] = swapMeetOptions(state, owner)
    if (options.length === 0) return []
    const spec: ActionSpec = { type: 'swapMeet', actor: owner, params: { options } }
    return [spec]
  },
}
