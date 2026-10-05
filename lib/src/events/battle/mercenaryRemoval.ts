import type { ActionSpec } from '#actions/types.js'
import type { BattleEvent } from '#events/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import {
  mercenaryWarriors,
  splitMercenaryHits,
  type MercenaryHitSplit,
} from '#queries/mercenaries.js'
import type { GameState } from '#state/types.js'

/** Hits a Mercenaries buyer must take, split between own and hired pieces. */
export interface MercenaryRemoval {
  split: MercenaryHitSplit
  ownWarriorIds: string[]
  mercenaryIds: string[]
  otherIds: string[]
}

interface HitVictim {
  event: BattleEvent
  victim: Seat
  maxHits: number
}

function idsOf(pieces: readonly Piece[]): string[] {
  return pieces.map((piece: Piece): string => piece.id)
}

/**
 * Rule: 11.2.7.IIIa Taking Hits — null unless the victim fights this battle
 * with hired Riverfolk warriors in the clearing.
 */
export function mercenaryRemovalFor(
  state: GameState,
  hit: HitVictim,
): MercenaryRemoval | null {
  const { event, victim, maxHits } = hit
  const opponent = victim === event.attacker ? event.defender : event.attacker
  const mercenaries = mercenaryWarriors(state, {
    clearing: event.clearing,
    seat: victim,
    opponent,
  })
  if (mercenaries.length === 0) return null
  const owned = state.clearings[event.clearing]!.pieces.filter(
    (piece: Piece): boolean => piece.owner === victim && piece.kind !== 'pawn',
  )
  const ownWarriors = owned.filter(
    (piece: Piece): boolean => piece.kind === 'warrior',
  )
  const others = owned.filter(
    (piece: Piece): boolean => piece.kind !== 'warrior',
  )
  return {
    split: splitMercenaryHits(
      {
        ownWarriors: ownWarriors.length,
        mercenaries: mercenaries.length,
        otherPieces: others.length,
      },
      maxHits,
    ),
    ownWarriorIds: idsOf(ownWarriors),
    mercenaryIds: idsOf(mercenaries),
    otherIds: idsOf(others),
  }
}

/** Every way to pick `size` ids, keeping their order. */
function combinations(ids: readonly string[], size: number): string[][] {
  if (size === 0) return [[]]
  if (ids.length < size) return []
  const [first, ...rest] = ids
  if (first === undefined) return []
  const withFirst = combinations(rest, size - 1).map(
    (combination: string[]): string[] => [first, ...combination],
  )
  return [...withFirst, ...combinations(rest, size)]
}

/**
 * Warriors are interchangeable, so only the choice of buildings and tokens
 * makes more than one spec.
 */
export function legalMercenaryRemovalSpecs(
  victim: Seat,
  removal: MercenaryRemoval,
): ActionSpec[] {
  const warriorIds = [
    ...removal.ownWarriorIds.slice(0, removal.split.ownWarriors),
    ...removal.mercenaryIds.slice(0, removal.split.mercenaries),
  ]
  return combinations(removal.otherIds, removal.split.otherPieces).map(
    (otherIds: string[]): ActionSpec => ({
      type: 'resolveEvent',
      actor: victim,
      params: { pieceIds: [...warriorIds, ...otherIds] },
    }),
  )
}

function countIn(pieceIds: readonly string[], pool: readonly string[]): number {
  return pieceIds.filter((id: string): boolean => pool.includes(id)).length
}

export function isValidMercenaryRemoval(
  removal: MercenaryRemoval,
  pieceIds: readonly string[],
): boolean {
  const { split } = removal
  if (new Set(pieceIds).size !== pieceIds.length) return false
  const total = split.ownWarriors + split.mercenaries + split.otherPieces
  if (pieceIds.length !== total) return false
  return (
    countIn(pieceIds, removal.ownWarriorIds) === split.ownWarriors &&
    countIn(pieceIds, removal.mercenaryIds) === split.mercenaries &&
    countIn(pieceIds, removal.otherIds) === split.otherPieces
  )
}
