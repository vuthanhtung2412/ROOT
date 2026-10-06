import { Deck, defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { randomIndex, type Rng } from '#rules/Rng.js'
import { RuleError } from '#rules/RuleError.js'
import {
  LIZARD_CONSPIRACY_COST,
  LIZARD_DRAW_BONUS_GARDEN_COUNT,
  LIZARD_GARDEN_VICTORY_POINTS,
  LIZARD_GARDENS_PER_SUIT,
  LIZARD_HATED_DISCOUNT,
  LIZARD_SUITS,
  type LizardBoard,
  type LizardConspiracy,
} from '#state/lizardBoard.js'
import type { GameState, PlayerState } from '#state/types.js'

/** Rule: 10.6.3 — draw one card before draw bonuses. */
const LIZARD_BASE_EVENING_DRAW = 1

export function lizardBoardOf(state: GameState, seat: Seat): LizardBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'lizard') {
    throw new RuleError('NOT_LIZARD', { seat })
  }
  return board
}

export function lizardSeat(state: GameState): Seat | null {
  const player = state.players.find(
    (entry: PlayerState): boolean => entry.faction === 'lizard',
  )
  return player?.seat ?? null
}

export function gardensOnMap(board: LizardBoard, suit: Suit): number {
  return LIZARD_GARDENS_PER_SUIT - board.gardens[suit]
}

/**
 * Rule: 10.5.3 Score — points above the rightmost empty Gardens space of the
 * suit; null while every garden of the suit is still on the track.
 */
export function gardenScoreVictoryPoints(
  board: LizardBoard,
  suit: Suit,
): number | null {
  const emptySpaces = gardensOnMap(board, suit)
  if (emptySpaces < 1) return null
  return LIZARD_GARDEN_VICTORY_POINTS[emptySpaces - 1] ?? null
}

/** Rule: 10.6.3 — one card, plus one per uncovered draw bonus. */
export function lizardEveningDrawCount(board: LizardBoard): number {
  const uncoveredBonuses = LIZARD_SUITS.filter(
    (suit: Suit): boolean =>
      gardensOnMap(board, suit) >= LIZARD_DRAW_BONUS_GARDEN_COUNT,
  ).length
  return LIZARD_BASE_EVENING_DRAW + uncoveredBonuses
}

/** Rule: 10.4.3 — a Hated Outcast makes each conspiracy cost one fewer acolyte. */
export function conspiracyCost(
  board: LizardBoard,
  conspiracy: LizardConspiracy,
): number {
  const discount = board.hated ? LIZARD_HATED_DISCOUNT : 0
  return Math.max(0, LIZARD_CONSPIRACY_COST[conspiracy] - discount)
}

/** Rule: 10.4.3 — spent acolytes return to the supply. */
export function spendAcolytes(board: LizardBoard, count: number): void {
  if (board.acolytes < count) {
    throw new RuleError('NOT_ENOUGH_ACOLYTES', {
      need: count,
      have: board.acolytes,
    })
  }
  board.acolytes -= count
  board.supply.warriors += count
}

export function outcastClearings(board: LizardBoard): ClearingId[] {
  return FALL.clearings
    .filter((clearing): boolean => clearing.suit === board.outcast)
    .map((clearing): ClearingId => clearing.id)
}

/** Rule: 10.2.1 — only gardens matching the Outcast suit craft. */
export function gardenCraftsInSuit(
  state: GameState,
  seat: Seat,
  suit: Suit,
): boolean {
  const board = playerOf(state, seat).board
  return board.kind === 'lizard' && board.outcast === suit
}

/** Rule: 10.2.4 Pilgrims — seat ruling a clearing through its gardens. */
export function pilgrimRuler(
  state: GameState,
  clearing: ClearingId,
): Seat | null {
  const garden = state.clearings[clearing]?.pieces.find(
    (piece): boolean => piece.kind === 'building' && piece.type === 'garden',
  )
  return garden?.owner ?? null
}

function suitTally(cards: readonly Card[]): Record<Suit, number> {
  const tally: Record<Suit, number> = { fox: 0, rabbit: 0, mouse: 0 }
  for (const card of cards) {
    const suit = defOf(card).suit
    // Rule: 10.4.1 — birds are ignored.
    if (suit === 'bird') continue
    tally[suit] += 1
  }
  return tally
}

/**
 * Rule: 10.4.1 Adjust Outcast, then 10.4.2 Discard Lost Souls
 * (dominance cards become available to take).
 */
export function adjustOutcast(state: GameState, seat: Seat): void {
  const board = lizardBoardOf(state, seat)
  const lostSouls = state.deck.lostSouls ?? []
  const tally = suitTally(lostSouls)
  const mostCards = Math.max(...LIZARD_SUITS.map((suit: Suit): number => tally[suit]))
  const leaders = LIZARD_SUITS.filter(
    (suit: Suit): boolean => tally[suit] === mostCards && mostCards > 0,
  )
  const soleLeader = leaders.length === 1 ? leaders[0] : undefined
  if (soleLeader === undefined || soleLeader === board.outcast) {
    board.hated = true
  } else {
    board.outcast = soleLeader
    board.hated = false
  }

  for (const card of lostSouls) {
    if (defOf(card).type === 'dominance') {
      state.dominanceAvailable.push(card)
    } else {
      state.deck.discard.push(card)
    }
  }
  state.deck.lostSouls = []
}

/** Rule: 10.2.5 Fear of the Faithful — a removed garden costs a random card. */
export function discardRandomCultCard(
  state: GameState,
  seat: Seat,
  rng: Rng | undefined,
): void {
  const hand = playerOf(state, seat).hand
  if (hand.length === 0) return
  const cardIndex = rng === undefined ? 0 : randomIndex(rng, hand.length)
  const card = hand.splice(cardIndex, 1)[0]!
  Deck.discard(state.deck, card, {
    onDominance: (dominanceCard: Card): void => {
      state.dominanceAvailable.push(dominanceCard)
    },
  })
}

/** Rule: Glossary > Return — a removed garden goes back to its Gardens track. */
export function returnGardenToTrack(
  state: GameState,
  seat: Seat,
  clearing: ClearingId,
): void {
  const board = lizardBoardOf(state, seat)
  const suit = FALL.clearings[clearing]!.suit
  board.gardens[suit] = Math.min(
    LIZARD_GARDENS_PER_SUIT,
    board.gardens[suit] + 1,
  )
}
