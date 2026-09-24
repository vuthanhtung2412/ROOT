import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'
import type { BattleEvent } from '#events/types.js'

export type RemovalSelection = {
  clearing: ClearingId
  victim: Seat
  pieceIds: string[]
  maxHits: number
}

export type RemovalStage = {
  event: BattleEvent
  action: ResolveEventAction
  victim: Seat
  maxHits: number
  scorer: Seat
}

export type OpenBattle = {
  clearing: ClearingId
  attacker: Seat
  defender: Seat
}

export type BattleEventApply = {
  event: BattleEvent
  action: ResolveEventAction
  actor: Seat
}

export type EventResolver = {
  legalActions(state: GameState, event: BattleEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: BattleEventApply, ctx: Ctx): LogEntry[]
  matchesAction(state: GameState, event: BattleEvent, action: Action, ctx: Ctx): boolean
}
