import type { CardSuit } from '#cards/types.js'
import { mechanicalMarquiseBoardOf } from '#factions/bots/botBoards.js'
import { placeBotWarriors, ruledClearings } from '#factions/bots/botQueries.js'
import {
  botDifficultyOf,
  botHasTrait,
  isChallengingOrHarder,
} from '#factions/bots/botSettings.js'
import { orderedClearings } from '#factions/bots/orderCard.js'
import { byHighestPriority, inTargetOrder } from '#factions/bots/priority.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { addVictoryPoints } from '#rules/dominance.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 4.5.2 — warriors placed by Recruit. */
const RECRUITED_WARRIORS = 4
/** Difficulty card Easy — "Recruit two warriors during the recruit action." */
const EASY_RECRUITED_WARRIORS = 2
/** Rule: Rootbotics 4.7.2 — warriors in each of the two lowest-priority clearings. */
const ESCALATED_RECRUIT_PER_CLEARING = 2
/** Trait Iron Will — "In Escalated Daylight recruit twice as many warriors." */
const IRON_WILL_MULTIPLIER = 2
/** Difficulty card Challenging / Nightmare — warriors placed after recruiting. */
const CHALLENGING_EXTRA_WARRIORS = 2
/** Trait Overwhelming — one point for every two warriors that cannot be placed. */
const OVERWHELMING_WARRIORS_PER_POINT = 2
/** Rule: Rootbotics 4.5.5 house cap, and Overwhelming's "only once per turn". */
const MAXIMUM_EXPAND_COUNT = 3
const OVERWHELMING_MAXIMUM_EXPAND_COUNT = 1

/** Easy halves every Recruit (Escalated too, as one per clearing). */
function easyShare(state: GameState, seat: Seat, warriors: number): number {
  return botDifficultyOf(state, seat) === 'easy'
    ? (warriors * EASY_RECRUITED_WARRIORS) / RECRUITED_WARRIORS
    : warriors
}

/** Rule: Rootbotics 4.5.2 + Easy — warriors the Recruit action places. */
export function recruitedWarriors(state: GameState, seat: Seat): number {
  return easyShare(state, seat, RECRUITED_WARRIORS)
}

/** Rule: Rootbotics 4.7.2 + Easy + Iron Will — warriors per clearing in Escalated Recruit. */
export function escalatedWarriorsPerClearing(state: GameState, seat: Seat): number {
  const multiplier = botHasTrait(state, seat, 'ironWill') ? IRON_WILL_MULTIPLIER : 1
  return easyShare(state, seat, ESCALATED_RECRUIT_PER_CLEARING) * multiplier
}

export function warriorSupply(state: GameState, seat: Seat): number {
  return mechanicalMarquiseBoardOf(state, seat).supply.warriors
}

/**
 * Trait Overwhelming — a point for every two Recruit warriors left unplaced
 * (empty supply or no legal clearing).
 */
export function scoreOverwhelming(
  state: GameState,
  recruit: { seat: Seat; unplaced: number },
  ctx: Ctx,
): LogEntry[] {
  const { seat, unplaced } = recruit
  if (!botHasTrait(state, seat, 'overwhelming')) return []
  const points = Math.floor(unplaced / OVERWHELMING_WARRIORS_PER_POINT)
  const scored = addVictoryPoints(state, seat, points)
  if (scored === 0) return []
  ctx.emit({ s: 'vp', actor: seat, delta: scored })
  return [{ t: 'vp', actor: seat, delta: scored, reason: 'overwhelming' }]
}

/**
 * Difficulty Challenging / Nightmare — after recruiting, two warriors in the
 * highest-priority ruled clearing matching the order card (a bird matches all).
 */
export function challengingRecruit(
  state: GameState,
  order: { seat: Seat; suit: CardSuit },
  ctx: Ctx,
): LogEntry[] {
  const { seat, suit } = order
  if (!isChallengingOrHarder(state, seat)) return []
  const ruled = ruledClearings(state, seat, ctx)
  const [clearing] = inTargetOrder(
    orderedClearings(suit).filter((candidate: ClearingId): boolean => ruled.includes(candidate)),
    [byHighestPriority],
  )
  if (clearing === undefined) return []
  return placeBotWarriors(state, { seat, clearing, count: CHALLENGING_EXTRA_WARRIORS })
}

/** Rule: Rootbotics 4.5.5 — how many Expands a turn may take (Overwhelming: one). */
export function maximumExpandCount(state: GameState, seat: Seat): number {
  return botHasTrait(state, seat, 'overwhelming')
    ? OVERWHELMING_MAXIMUM_EXPAND_COUNT
    : MAXIMUM_EXPAND_COUNT
}
