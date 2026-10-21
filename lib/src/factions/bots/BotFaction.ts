import type { Action, ActionSpec } from '#actions/types.js'
import { Faction } from '#factions/Faction.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { resetCraftingBuildingUsed } from '#rules/craft.js'
import { RuleError } from '#rules/RuleError.js'
import type { BotPlan, BotTask } from '#state/botTurn.js'
import { createTurnScratch } from '#state/turnScratch.js'
import type { GameState, Phase, Step } from '#state/types.js'

/** What one task did, and the tasks it adds in front of the rest. */
export type BotTaskResult = {
  logs: LogEntry[]
  followUps: BotTask[]
}

export function taskDone(logs: LogEntry[] = []): BotTaskResult {
  return { logs, followUps: [] }
}

/**
 * Rule: Rootbotics 2.6 — a bot plays its turn on its own. Each step is
 * planned as a list of tasks; the engine takes one `botStep` per task (so a
 * battle can wait for the human's answers), then an automatic `endPhase`.
 * Players can never act for a bot.
 */
export abstract class BotFaction extends Faction {
  /** The tasks of one step, from the state at the start of that step. */
  protected abstract planStep(state: GameState, seat: Seat): BotTask[]

  protected abstract runTask(
    state: GameState,
    task: BotTask,
    ctx: Ctx,
  ): BotTaskResult

  autoActions(state: GameState, phase: Phase, step: Step): Action[] {
    const plan = state.turnScratch.botPlan
    if (!isPlanFor(plan, { phase, step })) return [{ type: 'botStep' }]
    return plan.tasks.length > 0 ? [{ type: 'botStep' }] : [{ type: 'endPhase' }]
  }

  legalActions(_state: GameState, _ctx: Ctx): ActionSpec[] {
    return []
  }

  validate(_state: GameState, action: Action, _ctx: Ctx): void {
    if (action.type !== 'botStep') throw new RuleError('BOT_TURN', { action })
  }

  apply(state: GameState, action: Action, ctx: Ctx): LogEntry[] {
    if (action.type !== 'botStep') throw new RuleError('BOT_TURN', { action })
    const seat = state.currentSeat
    const current = state.turnScratch.botPlan
    const plan: BotPlan = isPlanFor(current, state)
      ? current
      : { phase: state.phase, step: state.step, tasks: this.planStep(state, seat) }
    const [task, ...rest] = plan.tasks
    if (task === undefined) {
      state.turnScratch.botPlan = plan
      return []
    }
    state.turnScratch.botPlan = { ...plan, tasks: rest }
    const result = this.runTask(state, task, ctx)
    const after: BotPlan = state.turnScratch.botPlan ?? { ...plan, tasks: [] }
    state.turnScratch.botPlan = {
      ...after,
      tasks: [...result.followUps, ...after.tasks],
    }
    return result.logs
  }

  endTurn(state: GameState): void {
    resetCraftingBuildingUsed(state, state.currentSeat)
    state.turnScratch = createTurnScratch()
  }
}

function isPlanFor(
  plan: BotPlan | null | undefined,
  where: { phase: Phase; step: Step },
): plan is BotPlan {
  return (
    plan !== null &&
    plan !== undefined &&
    plan.phase === where.phase &&
    plan.step === where.step
  )
}
