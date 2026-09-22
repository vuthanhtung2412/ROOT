import type { Action, ActionSpec } from '../actions/types.js'
import { Deck } from '../cards/Deck.js'
import type { CardEffect } from '../triggers/effects.js'
import type { Ctx } from '../game/ctx.js'
import { playerOf } from '../queries/seat.js'
import { RuleError } from '../rules/RuleError.js'
import type { GameState } from '../state/types.js'
import type { Seat } from '../pieces/types.js'

const CHARM_OFFENSIVE_DEF_ID = 'ROOT-59'

function charmOffensiveOwner(state: GameState): Seat | null {
  for (const player of state.players) {
    if (player.playArea.some((playCard) => playCard.defId === CHARM_OFFENSIVE_DEF_ID)) {
      return player.seat
    }
  }
  return null
}

/** Rule: Cards > Craft — Charm Offensive: Evening may draw + give another player 1 VP. */
export function tryApplyCharmOffensive(
  state: GameState,
  action: Action,
  ctx: Ctx,
): boolean {
  if (action.type !== 'charmOffensive') return false
  const ownerSeat = charmOffensiveOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }
  if (state.phase !== 'evening') throw new RuleError('WRONG_PHASE', { phase: state.phase })
  if (state.turnScratch.charmOffensiveUsed) {
    throw new RuleError('CHARM_OFFENSIVE_USED')
  }
  if (action.target === ownerSeat) throw new RuleError('INVALID_CHARM_TARGET')
  const target = state.players.find((player) => player.seat === action.target)
  if (!target) throw new RuleError('INVALID_CHARM_TARGET')

  const drawn = Deck.draw(state.deck, 1, {
    shuffle: (cards) => cards,
    onDominance: (card) => state.dominanceAvailable.push(card),
  })
  playerOf(state, ownerSeat).hand.push(...drawn)
  if (drawn.length > 0) {
    ctx.emit({ s: 'draw', actor: ownerSeat, count: drawn.length })
  }
  target.vp += 1
  ctx.emit({ s: 'vp', actor: target.seat, delta: 1 })
  state.turnScratch.charmOffensiveUsed = true
  return true
}

export const charmOffensiveEffect: CardEffect = {
  defId: CHARM_OFFENSIVE_DEF_ID,
  grants(state) {
    if (state.phase !== 'evening') return []
    if (state.turnScratch.charmOffensiveUsed) return []
    const ownerSeat = charmOffensiveOwner(state)
    if (ownerSeat === null || ownerSeat !== state.currentSeat) return []

    const specs: ActionSpec[] = []
    for (const other of state.players) {
      if (other.seat === ownerSeat) continue
      specs.push({ type: 'charmOffensive', actor: ownerSeat })
    }
    return specs
  },
}
