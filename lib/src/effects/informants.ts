import type { Action } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import type { CardEffect } from '#triggers/effects.js'
import type { Ctx } from '#game/ctx.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { Seat } from '#pieces/types.js'

const INFORMANTS_DEF_ID = 'ROOT-79'

function informantsOwner(state: GameState): Seat | null {
  for (const player of state.players) {
    if (player.playArea.some((playCard) => playCard.defId === INFORMANTS_DEF_ID)) {
      return player.seat
    }
  }
  return null
}

function ambushIdsInDiscard(state: GameState): string[] {
  return state.deck.discard
    .filter((discardCard) => defOf(discardCard).type === 'ambush')
    .map((discardCard) => discardCard.id)
}

function informantsCanReplaceDraw(state: GameState): boolean {
  const ownerSeat = informantsOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) return false
  if (state.phase !== 'evening' || state.step !== 'draw') return false
  if (state.turnScratch.eveningDrawDone) return false
  return ambushIdsInDiscard(state).length > 0
}

/** Rule: Cards > Craft — Informants: Evening may take ambush from discard instead of draw. */
export function tryApplyInformants(
  state: GameState,
  action: Action,
  _ctx: Ctx,
): boolean {
  if (action.type !== 'informantsTakeAmbush') return false
  const ownerSeat = informantsOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }
  if (state.phase !== 'evening' || state.step !== 'draw') {
    throw new RuleError('WRONG_PHASE', { phase: state.phase })
  }
  if (state.turnScratch.eveningDrawDone) throw new RuleError('EVENING_DRAW_DONE')

  const discardIndex = state.deck.discard.findIndex(
    (discardCard) => discardCard.id === action.cardId,
  )
  if (discardIndex < 0) throw new RuleError('CARD_NOT_IN_DISCARD', { cardId: action.cardId })
  const ambush = state.deck.discard[discardIndex]!
  if (defOf(ambush).type !== 'ambush') {
    throw new RuleError('NOT_AMBUSH', { cardId: action.cardId })
  }

  state.deck.discard.splice(discardIndex, 1)
  playerOf(state, ownerSeat).hand.push(ambush)
  state.turnScratch.eveningDrawDone = true
  return true
}

export const informantsEffect: CardEffect = {
  defId: INFORMANTS_DEF_ID,
  action: {
    types: ['informantsTakeAmbush'],
    apply: tryApplyInformants,
  },
  blocksAuto(state, action) {
    if (action.type !== 'eveningDraw') return false
    return informantsCanReplaceDraw(state)
  },
  grants(state) {
    if (!informantsCanReplaceDraw(state)) return []
    const ownerSeat = informantsOwner(state)
    if (ownerSeat === null) return []
    return [
      {
        type: 'informantsTakeAmbush',
        actor: ownerSeat,
        params: { cardIds: ambushIdsInDiscard(state) },
      },
    ]
  },
}
