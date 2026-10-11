import { actionMatchesOption, type ActionOption } from '#actions/options.js'
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
import type { RuleHooks } from '#triggers/hooks.js'

const EYRIE_EMIGRE_DEF_ID = 'ROOT-71'
const CLEARING_COUNT: number = FALL.clearings.length

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

/**
 * Every legal payload of the forced move: origin × destination × count, and
 * the defender of the battle that must follow when the destination holds an
 * enemy. A destination with no enemy has no defender: the card is discarded.
 */
function emigreOptions(
  state: GameState,
  ownerSeat: Seat,
  hooks: RuleHooks,
): ActionOption[] {
  const options: ActionOption[] = []
  for (let from = 0; from < CLEARING_COUNT; from++) {
    const available: number = warriors(state, from, ownerSeat)
    if (available < 1) continue
    for (let to = 0; to < CLEARING_COUNT; to++) {
      if (!canMove(state, { seat: ownerSeat, from, to }, hooks)) continue
      const defenders: Seat[] = enemySeatsInClearing(state, to, ownerSeat)
      for (let count = 1; count <= available; count++) {
        if (defenders.length === 0) {
          options.push({ from, to, count })
          continue
        }
        for (const defender of defenders) {
          options.push({ from, to, count, defender })
        }
      }
    }
  }
  return options
}

/**
 * Card text: "At end of Birdsong, you must take a move…". The spec of that
 * forced move for the player ending their Birdsong, or null when the card is
 * not theirs, already resolved, or no move is possible.
 */
export function eyrieEmigreForcedMove(
  state: GameState,
  hooks: RuleHooks,
): ActionSpec | null {
  const ownerSeat: Seat | null = emigreOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) return null
  if (state.phase !== 'birdsong') return null
  if (state.turnScratch.eyrieEmigreCompleted) return null
  const options: ActionOption[] = emigreOptions(state, ownerSeat, hooks)
  if (options.length === 0) return null
  return { type: 'eyrieEmigre', actor: ownerSeat, params: { options } }
}

/**
 * Rule: Cards > Craft — Eyrie Émigré: at end of Birdsong, move, then battle in
 * the destination. "Discard this if you did not take both actions."
 */
export function tryApplyEyrieEmigre(state: GameState, action: Action, ctx: Ctx): boolean {
  if (action.type !== 'eyrieEmigre') return false
  const ownerSeat = emigreOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }
  if (state.phase !== 'birdsong') throw new RuleError('WRONG_PHASE', { phase: state.phase })
  if (!state.turnScratch.endOfBirdsong) {
    throw new RuleError('NOT_END_OF_PHASE', { phase: state.phase })
  }
  if (state.turnScratch.eyrieEmigreCompleted) throw new RuleError('EMIGRE_DONE')
  if (!actionMatchesOption(action, emigreOptions(state, ownerSeat, ctx.hooks))) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }

  moveWarriors(
    state,
    { seat: ownerSeat, from: action.from, to: action.to, count: action.count },
    ctx,
  )
  state.turnScratch.eyrieEmigreCompleted = true
  if (action.defender === undefined) {
    // No enemy to battle in the destination: only one of the two actions.
    discardEmigre(state, ownerSeat)
    return true
  }
  openBattle(
    state,
    { clearing: action.to, attacker: ownerSeat, defender: action.defender },
    ctx,
  )
  return true
}

export const eyrieEmigreEffect: CardEffect = {
  defId: EYRIE_EMIGRE_DEF_ID,
  action: {
    types: ['eyrieEmigre'],
    apply: tryApplyEyrieEmigre,
  },
  // Birdsong ended with no move taken (none was possible): discard.
  onSignal(state, signal) {
    if (signal.s !== 'phase.end' || signal.phase !== 'birdsong') return
    const ownerSeat = emigreOwner(state)
    if (ownerSeat === null || signal.actor !== ownerSeat) return
    if (state.turnScratch.eyrieEmigreCompleted) return
    discardEmigre(state, ownerSeat)
  },
}
