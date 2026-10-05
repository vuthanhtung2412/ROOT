import type { Action, ActionSpec } from '#actions/types.js'
import { Deck, defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { matchesSuit } from '#cards/suit.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { rules } from '#queries/ruler.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'

/** Minimum VP to activate dominance. Rule: Dominance Cards 3.3.1. */
export const DOMINANCE_ACTIVATE_MIN_VP = 10

/** Vagabond coalitions only in 4+ player games. Rule: Vagabond 9.2.8. */
export const COALITION_MIN_PLAYER_COUNT = 4

export function addVictoryPoints(
  state: GameState,
  seat: Seat,
  delta: number,
): number {
  const player = playerOf(state, seat)
  if (!player.scoresVictoryPoints || delta === 0) {
    return 0
  }
  player.vp += delta
  return delta
}

export function isDaylightDominanceWindow(state: GameState): boolean {
  return state.status === 'playing' && state.phase === 'daylight'
}

/** Rule: Dominance 3.3.4 — take available by spending matching suit. */
export function pushTakeDominanceActions(
  state: GameState,
  seat: Seat,
  specs: ActionSpec[],
): void {
  if (!isDaylightDominanceWindow(state)) return
  if (state.dominanceAvailable.length === 0) return
  const hand = playerOf(state, seat).hand
  const spendIds = new Set<string>()
  for (const available of state.dominanceAvailable) {
    const availableSuit = defOf(available).suit
    for (const card of hand) {
      if (defOf(card).type === 'dominance') continue
      // Bird available: must spend bird (cannot treat as other suit).
      if (availableSuit === 'bird') {
        if (defOf(card).suit === 'bird') {
          spendIds.add(card.id)
        }
        continue
      }
      if (matchesSuit(card, availableSuit)) {
        spendIds.add(card.id)
      }
    }
  }
  if (spendIds.size === 0) return
  specs.push({
    type: 'takeDominance',
    actor: seat,
    params: { cardIds: [...spendIds] },
  })
}

/** Rule: Dominance 3.3.1 / Vagabond 9.2.8 — activate from hand. */
export function pushActivateDominanceActions(
  state: GameState,
  seat: Seat,
  specs: ActionSpec[],
): void {
  if (!isDaylightDominanceWindow(state)) return
  const player = playerOf(state, seat)
  if (player.activatedDominance !== null) return
  if (player.vp < DOMINANCE_ACTIVATE_MIN_VP) return
  const dominanceIds = player.hand
    .filter((card) => defOf(card).type === 'dominance')
    .map((card) => card.id)
  if (dominanceIds.length === 0) return

  if (player.faction === 'vagabond') {
    if (state.players.length < COALITION_MIN_PLAYER_COUNT) return
    const targets = coalitionTargetSeats(state, seat)
    if (targets.length === 0) return
    specs.push({
      type: 'activateDominance',
      actor: seat,
      params: { cardIds: dominanceIds, defender: targets },
    })
    return
  }

  specs.push({
    type: 'activateDominance',
    actor: seat,
    params: { cardIds: dominanceIds },
  })
}

export function coalitionTargetSeats(state: GameState, vagabondSeat: Seat): Seat[] {
  const others = state.players.filter((player) => player.seat !== vagabondSeat)
  if (others.length === 0) return []
  const alreadyCoalitioned = new Set(
    state.players
      .filter((player) => player.coalitionWith !== null)
      .map((player) => player.coalitionWith),
  )
  const eligible = others.filter(
    (player) =>
      player.coalitionWith === null && !alreadyCoalitioned.has(player.seat),
  )
  if (eligible.length === 0) return []
  let fewest = eligible[0]!.vp
  for (const player of eligible) {
    if (player.vp < fewest) fewest = player.vp
  }
  return eligible
    .filter((player) => player.vp === fewest)
    .map((player) => player.seat)
}

export function applyTakeDominance(
  state: GameState,
  seat: Seat,
  spendCardId: string,
): LogEntry[] {
  const player = playerOf(state, seat)
  const spendIndex = player.hand.findIndex((card) => card.id === spendCardId)
  if (spendIndex < 0) throw new RuleError('CARD_NOT_IN_HAND')
  const spendCard = player.hand[spendIndex]!
  if (defOf(spendCard).type === 'dominance') {
    throw new RuleError('CANNOT_SPEND_DOMINANCE_TO_TAKE')
  }

  const availableIndex = state.dominanceAvailable.findIndex((card) => {
    const suit = defOf(card).suit
    if (suit === 'bird') {
      return defOf(spendCard).suit === 'bird'
    }
    return matchesSuit(spendCard, suit)
  })
  if (availableIndex < 0) throw new RuleError('NO_MATCHING_DOMINANCE')

  const [taken] = state.dominanceAvailable.splice(availableIndex, 1)
  if (taken === undefined) throw new RuleError('NO_MATCHING_DOMINANCE')
  player.hand.splice(spendIndex, 1)
  Deck.discard(state.deck, spendCard, {
    onDominance: (dominanceCard: Card): void => {
      state.dominanceAvailable.push(dominanceCard)
    },
  })
  player.hand.push(taken)

  return [
    {
      t: 'action',
      actor: seat,
      action: { type: 'takeDominance', cardId: spendCardId },
    },
  ]
}

export type ActivateDominanceAction = Extract<
  Action,
  { type: 'activateDominance' }
>

export function applyActivateDominance(
  state: GameState,
  seat: Seat,
  action: ActivateDominanceAction,
): LogEntry[] {
  const player = playerOf(state, seat)
  if (player.activatedDominance !== null) {
    throw new RuleError('DOMINANCE_ALREADY_ACTIVATED')
  }
  if (player.vp < DOMINANCE_ACTIVATE_MIN_VP) {
    throw new RuleError('DOMINANCE_VP_TOO_LOW')
  }
  const handIndex = player.hand.findIndex((card) => card.id === action.cardId)
  if (handIndex < 0) throw new RuleError('CARD_NOT_IN_HAND')
  const card = player.hand[handIndex]!
  if (defOf(card).type !== 'dominance') {
    throw new RuleError('NOT_DOMINANCE')
  }

  player.hand.splice(handIndex, 1)
  player.activatedDominance = card
  player.scoresVictoryPoints = false

  if (player.faction === 'vagabond') {
    if (state.players.length < COALITION_MIN_PLAYER_COUNT) {
      throw new RuleError('COALITION_NEEDS_FOUR_PLAYERS')
    }
    if (action.coalitionTarget === undefined) {
      throw new RuleError('COALITION_TARGET_REQUIRED')
    }
    const targets = coalitionTargetSeats(state, seat)
    if (!targets.includes(action.coalitionTarget)) {
      throw new RuleError('ILLEGAL_COALITION_TARGET')
    }
    player.coalitionWith = action.coalitionTarget
    // Rule: 9.2.9.IIId — Hostile → Indifferent on coalition.
    const board = player.board
    if (board.kind === 'vagabond') {
      const partner = playerOf(state, action.coalitionTarget)
      if (board.relationships[partner.faction] === 'hostile') {
        board.relationships[partner.faction] = 0
      }
    }
  } else if (action.coalitionTarget !== undefined) {
    throw new RuleError('COALITION_ONLY_VAGABOND')
  }

  return [{ t: 'action', actor: seat, action }]
}

export function hasActivatedDominance(player: {
  activatedDominance: Card | null
}): boolean {
  return player.activatedDominance !== null
}

/** Opposite corner pairs on Fall. Rule: Dominance 3.3.1.II bird. */
export function oppositeCornerPairs(): Array<[ClearingId, ClearingId]> {
  const pairs: Array<[ClearingId, ClearingId]> = []
  const seen = new Set<string>()
  for (const corner of FALL.corners) {
    const opposite = FALL.opposite(corner)
    const key = [corner, opposite].sort((a, b) => a - b).join('-')
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push([corner, opposite])
  }
  return pairs
}

/**
 * Rule: Dominance 3.3.1 — at start of Birdsong, activated non-Vagabond wins
 * if they rule 3 matching suit clearings (or 2 opposite corners for bird).
 */
export function checkActivatedDominanceWin(
  state: GameState,
  context: Ctx,
): LogEntry[] {
  if (state.status !== 'playing' || state.phase !== 'birdsong') {
    return []
  }
  const player = playerOf(state, state.currentSeat)
  if (player.activatedDominance === null) return []
  if (player.faction === 'vagabond') return []

  const suit = defOf(player.activatedDominance).suit
  if (suit === 'bird') {
    const ok = oppositeCornerPairs().some(
      ([left, right]) =>
        rules(state, left, player.seat, context.hooks) &&
        rules(state, right, player.seat, context.hooks),
    )
    if (!ok) return []
  } else {
    let ruled = 0
    for (const clearing of FALL.clearings) {
      if (clearing.suit !== suit) continue
      if (rules(state, clearing.id, player.seat, context.hooks)) {
        ruled += 1
      }
    }
    if (ruled < 3) return []
  }

  return finishGameWithWinner(state, player.seat)
}

export function finishGameWithWinner(
  state: GameState,
  winner: Seat,
): LogEntry[] {
  state.winner = winner
  state.coWinners = state.players
    .filter((player) => player.coalitionWith === winner)
    .map((player) => player.seat)
  state.status = 'finished'
  return [{ t: 'win', winner }]
}
