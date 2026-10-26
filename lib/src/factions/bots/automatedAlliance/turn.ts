import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { automatedAllianceBoardOf } from '#factions/bots/botBoards.js'
import { placeBotWarriors } from '#factions/bots/botQueries.js'
import { botHasTrait } from '#factions/bots/botSettings.js'
import { orderSuitOf } from '#factions/bots/orderCard.js'
import { byHighestPriority, inTargetOrder } from '#factions/bots/priority.js'
import { revolt, revoltTarget } from '#factions/bots/automatedAlliance/revolt.js'
import {
  spreadSympathy,
  sympathyTokensOnMap,
} from '#factions/bots/automatedAlliance/sympathy.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { piecesIn, warriors } from '#queries/pieces.js'
import { returnWarriorsToSupply } from '#rules/remove.js'
import type { AutomatedAllianceTask } from '#state/botTurn.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 6.4.4 — four or fewer tokens on the map: spread twice. */
const PUBLIC_PITY_FEW_TOKENS = 4
const PUBLIC_PITY_SPREADS_WHEN_FEW = 2
const PUBLIC_PITY_SPREADS_WHEN_MANY = 1
/** Rule: Rootbotics 6.6.2 — one warrior per clearing with a base. */
const RECRUITED_WARRIORS_PER_BASE = 1

const SPREAD: AutomatedAllianceTask = { kind: 'spreadSympathy' }

function clearingsByPriority(): ClearingId[] {
  return inTargetOrder(
    FALL.clearings.map((clearing): ClearingId => clearing.id),
    [byHighestPriority],
  )
}

function hasBase(state: GameState, clearing: ClearingId, seat: Seat): boolean {
  return piecesIn(state, clearing).some(
    (piece: Piece): boolean =>
      piece.owner === seat && piece.kind === 'building' && piece.type === 'base',
  )
}

/** Rule: Rootbotics 6.4.3 — not on a bird: revolt in an ordered sympathetic clearing. */
export function birdsongRevolt(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const suit = orderSuitOf(automatedAllianceBoardOf(state, seat))
  if (suit === null || suit === 'bird') return taskDone()
  const clearing = revoltTarget(state, { seat, suit })
  if (clearing === null) return taskDone()
  state.turnScratch.botRevolted = true
  return taskDone(revolt(state, { seat, clearing }, ctx))
}

/** Rule: Rootbotics 6.5.2 — on a bird: revolt in such a clearing of any suit. */
export function surpriseRevolt(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  if (orderSuitOf(automatedAllianceBoardOf(state, seat)) !== 'bird') return taskDone()
  const clearing = revoltTarget(state, { seat, suit: 'bird' })
  if (clearing === null) return taskDone()
  return taskDone(revolt(state, { seat, clearing }, ctx))
}

/** Trait Steadfast — a bird order with a clearing to revolt in: the Surprise Revolt happens. */
function surpriseRevoltComing(state: GameState, seat: Seat): boolean {
  if (orderSuitOf(automatedAllianceBoardOf(state, seat)) !== 'bird') return false
  return revoltTarget(state, { seat, suit: 'bird' }) !== null
}

/** Rule: Rootbotics 6.4.4 — no Birdsong revolt: spread twice (≤ 4 tokens) or once. */
export function publicPity(state: GameState, seat: Seat): BotTaskResult {
  if (state.turnScratch.botRevolted === true) return taskDone()
  if (botHasTrait(state, seat, 'steadfast') && surpriseRevoltComing(state, seat)) return taskDone()
  const spreads =
    sympathyTokensOnMap(state, seat) <= PUBLIC_PITY_FEW_TOKENS
      ? PUBLIC_PITY_SPREADS_WHEN_FEW
      : PUBLIC_PITY_SPREADS_WHEN_MANY
  return { logs: [], followUps: Array.from({ length: spreads }, (): AutomatedAllianceTask => SPREAD) }
}

/**
 * Rule: Rootbotics 6.6.1 — in each clearing with a base and three or more
 * Alliance warriors, remove them all, then spread sympathy.
 */
export function organize(
  state: GameState,
  organizing: { seat: Seat; threshold: number },
  ctx: Ctx,
): LogEntry[] {
  const { seat, threshold } = organizing
  const logs: LogEntry[] = []
  for (const clearing of clearingsByPriority()) {
    const count = warriors(state, clearing, seat)
    if (!hasBase(state, clearing, seat) || count < threshold) continue
    const clearingState = state.clearings[clearing]!
    const removed: Piece[] = clearingState.pieces.filter(
      (piece: Piece): boolean => piece.owner === seat && piece.kind === 'warrior',
    )
    clearingState.pieces = clearingState.pieces.filter(
      (piece: Piece): boolean => !removed.includes(piece),
    )
    returnWarriorsToSupply(state, seat, removed.length)
    logs.push(
      { t: 'action', actor: seat, action: { type: 'botOrganize', clearing } },
      { t: 'pieces', clearing, removed },
      ...spreadSympathy(state, { seat, scores: true }, ctx),
    )
  }
  return logs
}

/** Rule: Rootbotics 6.6.2 — one warrior in each clearing with a base. */
export function recruitAtBases(state: GameState, seat: Seat): LogEntry[] {
  return clearingsByPriority()
    .filter((clearing: ClearingId): boolean => hasBase(state, clearing, seat))
    .flatMap((clearing: ClearingId): LogEntry[] =>
      placeBotWarriors(state, { seat, clearing, count: RECRUITED_WARRIORS_PER_BASE }),
    )
}
