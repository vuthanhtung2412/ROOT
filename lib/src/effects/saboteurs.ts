import type { Action } from '#actions/types.js'
import { Deck } from '#cards/Deck.js'
import type { CardEffect } from '#triggers/effects.js'
import type { Ctx } from '#game/ctx.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'

const SABOTEURS_DEF_ID = 'ROOT-93'

function saboteursOwner(state: GameState): Seat | null {
  for (const player of state.players) {
    if (player.playArea.some((playCard) => playCard.defId === SABOTEURS_DEF_ID)) {
      return player.seat
    }
  }
  return null
}

function enemyCraftedCards(
  state: GameState,
  ownerSeat: Seat,
): Array<{ target: Seat; cardId: string }> {
  const out: Array<{ target: Seat; cardId: string }> = []
  for (const player of state.players) {
    if (player.seat === ownerSeat) continue
    for (const playCard of player.playArea) {
      out.push({ target: player.seat, cardId: playCard.id })
    }
  }
  return out
}

function saboteursAvailable(state: GameState): boolean {
  const ownerSeat = saboteursOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) return false
  if (state.phase !== 'birdsong') return false
  if (state.turnScratch.saboteursUsed) return false
  return enemyCraftedCards(state, ownerSeat).length > 0
}

/** Rule: Cards > Craft — Saboteurs: discard self to discard enemy crafted card. */
export function tryApplySaboteurs(state: GameState, action: Action, _ctx: Ctx): boolean {
  if (action.type !== 'saboteurs') return false
  const ownerSeat = saboteursOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }
  if (state.phase !== 'birdsong') throw new RuleError('WRONG_PHASE', { phase: state.phase })
  if (state.turnScratch.saboteursUsed) throw new RuleError('SABOTEURS_USED')

  const targets = enemyCraftedCards(state, ownerSeat)
  const match = targets.find(
    (entry) => entry.target === action.target && entry.cardId === action.cardId,
  )
  if (!match) throw new RuleError('INVALID_SABOTEUR_TARGET')

  const owner = playerOf(state, ownerSeat)
  const selfIndex = owner.playArea.findIndex((playCard) => playCard.defId === SABOTEURS_DEF_ID)
  if (selfIndex < 0) throw new RuleError('SABOTEURS_NOT_IN_PLAY')
  const selfCard = owner.playArea.splice(selfIndex, 1)[0]!
  Deck.discard(state.deck, selfCard, {
    onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
  })

  const enemy = playerOf(state, action.target)
  const enemyIndex = enemy.playArea.findIndex((playCard) => playCard.id === action.cardId)
  if (enemyIndex < 0) throw new RuleError('INVALID_SABOTEUR_TARGET')
  const enemyCard = enemy.playArea.splice(enemyIndex, 1)[0]!
  Deck.discard(state.deck, enemyCard, {
    onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
  })

  state.turnScratch.saboteursUsed = true
  return true
}

export const saboteursEffect: CardEffect = {
  defId: SABOTEURS_DEF_ID,
  action: {
    types: ['saboteurs'],
    apply: tryApplySaboteurs,
  },
  grants(state) {
    if (!saboteursAvailable(state)) return []
    const ownerSeat = saboteursOwner(state)
    if (ownerSeat === null) return []
    return [{ type: 'saboteurs', actor: ownerSeat }]
  },
}
