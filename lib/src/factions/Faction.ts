import type { Action, ActionSpec } from '../actions/types.js'
import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import type { FactionId, Seat } from '../pieces/types.js'
import type { GameState, Phase, Step } from '../state/types.js'

export abstract class Faction {
  abstract readonly id: FactionId
  abstract readonly steps: Record<Phase, Step[]>

  abstract setup(state: GameState, seat: Seat, ctx: Ctx): void

  autoActions(_state: GameState, _phase: Phase, _step: Step): Action[] {
    return []
  }

  abstract legalActions(state: GameState, ctx: Ctx): ActionSpec[]
  abstract validate(state: GameState, action: Action, ctx: Ctx): void
  abstract apply(state: GameState, action: Action, ctx: Ctx): LogEntry[]

  endTurn(_state: GameState): void {}
}
