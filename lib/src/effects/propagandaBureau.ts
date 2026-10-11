import type { Action } from '#actions/types.js'
import { Deck } from '#cards/Deck.js'
import { matchesSuit } from '#cards/suit.js'
import type { CardEffect } from '#triggers/effects.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { canPlace } from '#queries/place.js'
import { playerOf } from '#queries/seat.js'
import { warriorSupplyOf, type WarriorSupply } from '#queries/supply.js'
import { placeUpTo } from '#rules/place.js'
import { removePieces } from '#rules/remove.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'

const PROPAGANDA_DEF_ID = 'ROOT-86'

function propagandaOwner(state: GameState): Seat | null {
  for (const player of state.players) {
    if (player.playArea.some((playCard) => playCard.defId === PROPAGANDA_DEF_ID)) {
      return player.seat
    }
  }
  return null
}

/** Rule: G.1.21 Replace — the owner needs a warrior in supply to place. */
function hasWarriorToPlace(state: GameState, ownerSeat: Seat): boolean {
  const supply: WarriorSupply | null = warriorSupplyOf(
    playerOf(state, ownerSeat).board,
  )
  return supply !== null && supply.warriors > 0
}

function propagandaAvailable(state: GameState): boolean {
  const ownerSeat = propagandaOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) return false
  if (state.phase !== 'daylight') return false
  if (state.turnScratch.propagandaUsed) return false
  if (!hasWarriorToPlace(state, ownerSeat)) return false
  return playerOf(state, ownerSeat).hand.length > 0
}

function enemyWarriorTargets(
  state: GameState,
  ownerSeat: Seat,
  cardId: string,
): Array<{ clearing: ClearingId; pieceId: string; defender: Seat }> {
  const handCard = playerOf(state, ownerSeat).hand.find((card) => card.id === cardId)
  if (!handCard) return []
  const targets: Array<{ clearing: ClearingId; pieceId: string; defender: Seat }> = []
  for (let clearing = 0; clearing < 12; clearing++) {
    if (!matchesSuit(handCard, FALL.clearings[clearing]!.suit)) continue
    // Rule: G.1.21 Replace — every step must be possible (6.2.2 The Keep).
    if (!canPlace(state, ownerSeat, clearing)) continue
    for (const piece of state.clearings[clearing]!.pieces) {
      if (piece.kind !== 'warrior' || piece.owner === ownerSeat) continue
      targets.push({ clearing, pieceId: piece.id, defender: piece.owner })
    }
  }
  return targets
}

/** Rule: Cards > Craft — Propaganda Bureau: spend card → replace enemy warrior. */
export function tryApplyPropagandaBureau(
  state: GameState,
  action: Action,
  ctx: Ctx,
): boolean {
  if (action.type !== 'propagandaBureau') return false
  const ownerSeat = propagandaOwner(state)
  if (ownerSeat === null || ownerSeat !== state.currentSeat) {
    throw new RuleError('ILLEGAL_ACTION', { action })
  }
  if (state.phase !== 'daylight') throw new RuleError('WRONG_PHASE', { phase: state.phase })
  if (state.turnScratch.propagandaUsed) throw new RuleError('PROPAGANDA_USED')
  if (!hasWarriorToPlace(state, ownerSeat)) {
    throw new RuleError('NO_WARRIORS_IN_SUPPLY')
  }

  const targets = enemyWarriorTargets(state, ownerSeat, action.cardId)
  const target = targets.find(
    (entry) => entry.clearing === action.clearing && entry.pieceId === action.pieceId,
  )
  if (!target) throw new RuleError('INVALID_PROPAGANDA_TARGET')

  const player = playerOf(state, ownerSeat)
  const cardIndex = player.hand.findIndex((card) => card.id === action.cardId)
  if (cardIndex < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId: action.cardId })
  const spent = player.hand.splice(cardIndex, 1)[0]!
  Deck.discard(state.deck, spent, {
    onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
  })

  // Rule: G.1.21 Replace — remove then place: the removal is a real one
  // (6.2.3 Field Hospitals may answer it).
  removePieces(
    state,
    {
      clearing: action.clearing,
      pieceIds: [action.pieceId],
      scorer: ownerSeat,
      options: { replaced: true },
    },
    ctx,
  )

  const placed = placeUpTo(state, {
    seat: ownerSeat,
    clearing: action.clearing,
    spec: { kind: 'warrior' },
    count: 1,
  })
  if (placed < 1) throw new RuleError('NO_WARRIORS_IN_SUPPLY')

  state.turnScratch.propagandaUsed = true
  return true
}

export const propagandaBureauEffect: CardEffect = {
  defId: PROPAGANDA_DEF_ID,
  action: {
    types: ['propagandaBureau'],
    apply: tryApplyPropagandaBureau,
  },
  grants(state) {
    if (!propagandaAvailable(state)) return []
    const ownerSeat = propagandaOwner(state)
    if (ownerSeat === null) return []
    for (const handCard of playerOf(state, ownerSeat).hand) {
      if (enemyWarriorTargets(state, ownerSeat, handCard.id).length > 0) {
        return [{ type: 'propagandaBureau', actor: ownerSeat }]
      }
    }
    return []
  },
}
