import { BotFaction, taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { mechanicalMarquiseBoardOf } from '#factions/bots/botBoards.js'
import { scoreNightmareEvening } from '#factions/bots/botSettings.js'
import { eveningVictoryPoints } from '#factions/bots/mechanicalMarquise/buildings.js'
import { placeMechanicalMarquiseSetup } from '#factions/bots/mechanicalMarquise/setup.js'
import {
  daylightTasks,
  runMechanicalMarquiseDaylightTask,
} from '#factions/bots/mechanicalMarquise/turn.js'
import {
  craftOrderCard,
  discardOrderCard,
  orderSuitOf,
  revealOrderCard,
} from '#factions/bots/orderCard.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { addVictoryPoints } from '#rules/dominance.js'
import type { BotTask } from '#state/botTurn.js'
import type { GameState, Phase, Step } from '#state/types.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['order'],
  daylight: ['actions'],
  evening: ['score'],
}

/** Rule: Rootbotics 4.6.1 — score the ordered Buildings track. */
function scoreEvening(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const suit = orderSuitOf(mechanicalMarquiseBoardOf(state, seat))
  if (suit === null) return []
  const scored = addVictoryPoints(state, seat, eveningVictoryPoints(state, seat, suit))
  if (scored === 0) return []
  ctx.emit({ s: 'vp', actor: seat, delta: scored })
  return [{ t: 'vp', actor: seat, delta: scored, reason: 'buildings track' }]
}

/** Rule: Rootbotics 4 — Mechanical Marquise 2.0. Plays its turn by itself. */
export class MechanicalMarquise extends BotFaction {
  readonly id = 'mechanicalMarquise' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, ctx: Ctx): void {
    placeMechanicalMarquiseSetup(state, seat, ctx.rng)
  }

  protected planStep(state: GameState, seat: Seat): BotTask[] {
    switch (state.phase) {
      // Rule: Rootbotics 4.4 — reveal, then craft.
      case 'birdsong':
        return [{ kind: 'revealOrder' }, { kind: 'craftOrder' }]
      case 'daylight':
        return daylightTasks(state, seat)
      // Rule: Rootbotics 4.6 — score, then discard the order; Nightmare's point last.
      case 'evening':
        return [{ kind: 'score' }, { kind: 'discardOrder' }, { kind: 'nightmareScore' }]
    }
  }

  protected runTask(state: GameState, task: BotTask, ctx: Ctx): BotTaskResult {
    const seat = state.currentSeat
    switch (task.kind) {
      case 'revealOrder':
        return taskDone(revealOrderCard(state, seat, ctx))
      case 'craftOrder':
        return taskDone(craftOrderCard(state, seat, ctx))
      case 'score':
        return taskDone(scoreEvening(state, seat, ctx))
      case 'discardOrder':
        discardOrderCard(state, seat)
        return taskDone()
      case 'nightmareScore':
        return taskDone(scoreNightmareEvening(state, seat, ctx))
      case 'battle':
      case 'recruit':
      case 'build':
      case 'move':
      case 'expand':
      case 'escalatedRecruit':
      case 'escalatedBuild':
      case 'escalatedMoves':
      case 'blitz':
        return runMechanicalMarquiseDaylightTask(state, task, ctx)
      default:
        return taskDone()
    }
  }
}

export const MECHANICAL_MARQUISE = new MechanicalMarquise()
