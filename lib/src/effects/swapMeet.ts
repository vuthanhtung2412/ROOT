import type { Action, ActionSpec } from '#actions/types.js'
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

  const giver = playerOf(state, owner)
  const target = playerOf(state, action.target)
  if (target.seat === owner) throw new RuleError('INVALID_SWAP_TARGET')
  if (target.hand.length < 1) throw new RuleError('TARGET_HAND_EMPTY')
  const giveIdx = giver.hand.findIndex((c) => c.id === action.giveCardId)
  if (giveIdx < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId: action.giveCardId })

  const takeIdx =
    target.hand.length === 1 ? 0 : randomIndex(ctx.rng, target.hand.length)
  const taken = target.hand.splice(takeIdx, 1)[0]!
  const given = giver.hand.splice(giveIdx, 1)[0]!
  giver.hand.push(taken)
  target.hand.push(given)
  state.turnScratch.swapMeetUsed = true
  return true
}

export const swapMeetEffect: CardEffect = {
  defId: DEF_ID,
  grants(state) {
    if (state.phase !== 'birdsong') return []
    if (state.turnScratch.swapMeetUsed) return []
    const owner = swapMeetOwner(state)
    if (owner === null || owner !== state.currentSeat) return []

    const specs: ActionSpec[] = []
    for (const other of state.players) {
      if (other.seat === owner || other.hand.length < 1) continue
      if (playerOf(state, owner).hand.length < 1) continue
      specs.push({ type: 'swapMeet', actor: owner })
    }
    return specs
  },
}
