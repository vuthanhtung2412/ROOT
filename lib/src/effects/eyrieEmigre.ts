import type { Action, ActionSpec } from '#actions/types.js'
import { Deck } from '#cards/Deck.js'
import type { CardEffect } from '#triggers/effects.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { Seat } from '#pieces/types.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { canMove } from '#queries/move.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { openBattle } from '#events/battle.js'
import { moveWarriors } from '#rules/move.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'

const EYRIE_EMIGRE_DEF_ID = 'ROOT-71'

function emigreOwner(state: GameState): Seat | null {
  for (const player of state.players) {
    if (player.playArea.some((playCard) => playCard.defId === EYRIE_EMIGRE_DEF_ID)) {
      return player.seat
    }
  }
  return null
}

function discardEmigre(state: GameState, ownerSeat: Seat): void {
  const owner = playerOf(state, ownerSeat)
  const index = owner.playArea.findIndex((playCard) => playCard.defId === EYRIE_EMIGRE_DEF_ID)
  if (index < 0) return
  const card = owner.playArea.splice(index, 1)[0]!
  Deck.discard(state.deck, card, {
    onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
  })
}

/** Rule: Cards > Craft — Eyrie Émigré: end Birdsong must move then battle or discard. */
export function tryApplyEyrieEmigre(state: GameState, action: Action, ctx: Ctx): boolean {
  if (action.type !== 'eyrieEmigre') return false
  const ownerSeat = emigreOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }
  if (state.phase !== 'birdsong') throw new RuleError('WRONG_PHASE', { phase: state.phase })
  if (state.turnScratch.eyrieEmigreCompleted) throw new RuleError('EMIGRE_DONE')

  const hooks = buildRuleHooks(state, FALL)
  if (!canMove(state, { seat: ownerSeat, from: action.from, to: action.to }, hooks)) {
    throw new RuleError('CANNOT_MOVE', { from: action.from, to: action.to })
  }
  if (!enemySeatsInClearing(state, action.to, ownerSeat).includes(action.defender)) {
    throw new RuleError('INVALID_BATTLE_TARGET', { defender: action.defender })
  }
  moveWarriors(
    state,
    { seat: ownerSeat, from: action.from, to: action.to, count: action.count },
    ctx,
  )
  openBattle(
    state,
    { clearing: action.to, attacker: ownerSeat, defender: action.defender },
    ctx,
  )
  state.turnScratch.eyrieEmigreCompleted = true
  return true
}

export const eyrieEmigreEffect: CardEffect = {
  defId: EYRIE_EMIGRE_DEF_ID,
  action: {
    types: ['eyrieEmigre'],
    apply: tryApplyEyrieEmigre,
  },
  onSignal(state, signal) {
    if (signal.s !== 'phase.end' || signal.phase !== 'birdsong') return
    const ownerSeat = emigreOwner(state)
    if (ownerSeat === null || signal.actor !== ownerSeat) return
    if (state.turnScratch.eyrieEmigreCompleted) return
    discardEmigre(state, ownerSeat)
  },
  grants(state) {
    const ownerSeat = emigreOwner(state)
    if (ownerSeat === null || ownerSeat !== state.currentSeat) return []
    if (state.phase !== 'birdsong') return []
    if (state.turnScratch.eyrieEmigreCompleted) return []

    const hooks = buildRuleHooks(state, FALL)
    const specs: ActionSpec[] = []
    for (let from = 0; from < 12; from++) {
      const available = warriors(state, from, ownerSeat)
      if (available < 1) continue
      for (let to = 0; to < 12; to++) {
        if (!canMove(state, { seat: ownerSeat, from, to }, hooks)) continue
        // Destination must have an enemy after the move — approximate with enemies already there
        // or warriors moving in to empty enemy-held clearing. Require enemy present at `to`.
        const defenders = enemySeatsInClearing(state, to, ownerSeat)
        if (defenders.length === 0) continue
        specs.push({ type: 'eyrieEmigre', actor: ownerSeat })
        return specs
      }
    }
    return specs
  },
}
