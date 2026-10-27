import type { BattleEvent } from '#events/types.js'
import { usesHigherRollAsDefender } from '#factions/bots/automatedAlliance/cards.js'
import { botHasTrait } from '#factions/bots/botSettings.js'
import type { Piece, Seat } from '#pieces/types.js'
import { piecesIn, warriors } from '#queries/pieces.js'
import { factionOf } from '#queries/seat.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 6.2.2 — one extra hit. */
const AUTOMATED_AMBUSH_EXTRA_HITS = 1

/**
 * Rule: Rootbotics 6.2.2 Automated Ambush — as defender with at least one
 * Alliance warrior in the clearing, the Automated Alliance deals an extra hit.
 */
export function automatedAmbushHits(state: GameState, event: BattleEvent): number {
  if (factionOf(state, event.defender) !== 'automatedAlliance') return 0
  if (warriors(state, event.clearing, event.defender) >= 1) return AUTOMATED_AMBUSH_EXTRA_HITS
  // Trait Informants — defenseless sympathy tokens benefit from Automated Ambush.
  const defendsSympathy = piecesIn(state, event.clearing).some(
    (piece: Piece): boolean =>
      piece.owner === event.defender && piece.kind === 'token' && piece.type === 'sympathy',
  )
  return defendsSympathy && botHasTrait(state, event.defender, 'informants')
    ? AUTOMATED_AMBUSH_EXTRA_HITS
    : 0
}

/**
 * Guerrilla War (Woodland Alliance) and trait Veterans (Automated Alliance):
 * as defender use the higher roll, the attacker the lower.
 */
export function defenderUsesHigherRoll(state: GameState, defender: Seat): boolean {
  const faction = factionOf(state, defender)
  if (faction === 'alliance') return true
  return faction === 'automatedAlliance' && usesHigherRollAsDefender(state, defender)
}
