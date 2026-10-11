import { addVictoryPoints } from '#rules/dominance.js'
import type { ActionOption } from '#actions/options.js'
import type { Action, ActionSpec } from '#actions/types.js'
import { Deck } from '#cards/Deck.js'
import type { CardEffect } from '#triggers/effects.js'
import type { Ctx } from '#game/ctx.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import type { Seat } from '#pieces/types.js'

const CHARM_OFFENSIVE_DEF_ID = 'ROOT-59'

function charmOffensiveOwner(state: GameState): Seat | null {
  for (const player of state.players) {
    if (player.playArea.some((playCard) => playCard.defId === CHARM_OFFENSIVE_DEF_ID)) {
      return player.seat
    }
  }
  return null
}

/**
 * Seat that may use the card right now, or null. Card text: "At start of
 * Evening" — over once the owner took another action in Evening.
 */
function charmOffensiveAvailableTo(state: GameState): Seat | null {
  if (state.phase !== 'evening') return null
  if (state.turnScratch.charmOffensiveUsed) return null
  if (state.turnScratch.phaseActionTaken) return null
  const ownerSeat: Seat | null = charmOffensiveOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) return null
  return ownerSeat
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
  if (state.turnScratch.phaseActionTaken) {
    throw new RuleError('NOT_START_OF_PHASE', { phase: state.phase })
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
  const scored = addVictoryPoints(state, target.seat, 1)
  if (scored > 0) ctx.emit({ s: 'vp', actor: target.seat, delta: scored })
  state.turnScratch.charmOffensiveUsed = true
  return true
}

export const charmOffensiveEffect: CardEffect = {
  defId: CHARM_OFFENSIVE_DEF_ID,
  action: {
    types: ['charmOffensive'],
    apply: tryApplyCharmOffensive,
  },
  // The Evening draw waits while the card can still be used: "at start of
  // Evening" comes before the draw.
  blocksAuto(state, action) {
    if (action.type !== 'eveningDraw') return false
    return charmOffensiveAvailableTo(state) !== null
  },
  grants(state) {
    const ownerSeat: Seat | null = charmOffensiveAvailableTo(state)
    if (ownerSeat === null) return []

    // Every legal payload: another player to score the point.
    const options: ActionOption[] = []
    for (const other of state.players) {
      if (other.seat === ownerSeat) continue
      options.push({ target: other.seat })
    }
    if (options.length === 0) return []
    const spec: ActionSpec = {
      type: 'charmOffensive',
      actor: ownerSeat,
      params: { options },
    }
    return [spec]
  },
}
