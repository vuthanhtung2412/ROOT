import type { CardSuit } from '#cards/types.js'
import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { orderSuitOf } from '#factions/bots/orderCard.js'
import {
  damagedItems,
  refreshItems,
  repairItems,
  undamagedItems,
} from '#factions/bots/vagabot/items.js'
import { slipToRandomForest } from '#factions/bots/vagabot/pawn.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import type { VagabotTask } from '#state/botTurn.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 7.4.3 — two or fewer undamaged items: slip. */
const SLIP_UNDAMAGED_ITEMS = 2
/** Rule: Rootbotics 7.6.1 — refresh four with a damaged item, six without. */
export const REFRESH_WITH_DAMAGE = 4
export const REFRESH_WITHOUT_DAMAGE = 6
/** Rule: Rootbotics 7.6.2 — out of a forest, repair one item. */
const REPAIRS_OUTSIDE_FOREST = 1

export type VagabotAction = 'explore' | 'quest' | 'aid' | 'battle' | 'repair' | 'special'

/** Rule: Rootbotics 7.5 / Vagabot board — Daylight Actions by order suit. */
export const DAYLIGHT_ACTIONS: Readonly<Record<CardSuit, readonly VagabotAction[]>> = {
  fox: ['explore', 'battle', 'special'],
  rabbit: ['battle', 'repair', 'special'],
  mouse: ['quest', 'aid', 'battle', 'repair'],
  bird: ['explore', 'quest', 'aid', 'battle'],
}

/** Rule: Rootbotics 7.5 — the order card sets the actions; none after a slip. */
export function daylightTasks(
  state: GameState,
  seat: Seat,
  actions: Readonly<Record<CardSuit, readonly VagabotAction[]>> = DAYLIGHT_ACTIONS,
): VagabotTask[] {
  if (state.turnScratch.botSlipped === true) return []
  const suit = orderSuitOf(vagabotBoardOf(state, seat))
  if (suit === null) return []
  return actions[suit].map(taskOf)
}

function taskOf(action: VagabotAction): VagabotTask {
  return action === 'battle' ? { kind: 'battleTarget' } : { kind: action }
}

/** Rule: Rootbotics 7.4.3 Slip — two or fewer undamaged items: forest, skip Daylight. */
export function slip(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  if (undamagedItems(vagabotBoardOf(state, seat)).length > SLIP_UNDAMAGED_ITEMS) return taskDone()
  state.turnScratch.botSlipped = true
  return taskDone(slipToRandomForest(state, seat, ctx.rng))
}

/** Rule: Rootbotics 7.6.1 Refresh — four items with a damaged one, else six (± difficulty). */
export function refresh(
  state: GameState,
  refreshing: { seat: Seat; difficultyBonus: number },
): LogEntry[] {
  const board = vagabotBoardOf(state, refreshing.seat)
  const base = damagedItems(board).length > 0 ? REFRESH_WITH_DAMAGE : REFRESH_WITHOUT_DAMAGE
  const count = refreshItems(board, Math.max(0, base + refreshing.difficultyBonus))
  return [{ t: 'action', actor: refreshing.seat, action: { type: 'botRefresh', count } }]
}

/** Rule: Rootbotics 7.6.2 Repair — every item in a forest, one elsewhere. */
export function eveningRepair(state: GameState, seat: Seat): LogEntry[] {
  const board = vagabotBoardOf(state, seat)
  const damaged = damagedItems(board).length
  const repairs = board.forest === null ? REPAIRS_OUTSIDE_FOREST : damaged
  const repaired = repairItems(board, repairs)
  if (repaired === 0) return []
  return [{ t: 'action', actor: seat, action: { type: 'botRepair' } }]
}
