import { BotFaction, taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import {
  decreeBattle,
  decreeMove,
  decreeRecruit,
  decreeTasks,
} from '#factions/bots/electricEyrie/decree.js'
import {
  addOrderToDecree,
  buildRoost,
  newRoost,
  scoreRoosts,
} from '#factions/bots/electricEyrie/roosts.js'
import { placeElectricEyrieSetup } from '#factions/bots/electricEyrie/setup.js'
import { craftOrderCard, revealOrderCard } from '#factions/bots/orderCard.js'
import type { Ctx } from '#game/ctx.js'
import type { Seat } from '#pieces/types.js'
import type { BotTask } from '#state/botTurn.js'
import type { GameState, Phase, Step } from '#state/types.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['order'],
  daylight: ['decree'],
  evening: ['score'],
}

/** Rule: Rootbotics 5 — Electric Eyrie. Plays its turn by itself. */
export class ElectricEyrie extends BotFaction {
  readonly id = 'electricEyrie' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, ctx: Ctx): void {
    placeElectricEyrieSetup(state, seat, ctx.rng)
  }

  protected planStep(state: GameState, seat: Seat): BotTask[] {
    switch (state.phase) {
      // Rule: Rootbotics 5.4 — reveal, craft, add to the Decree, a new roost.
      case 'birdsong':
        return [
          { kind: 'revealOrder' },
          { kind: 'craftOrder' },
          { kind: 'addToDecree' },
          { kind: 'newRoost' },
        ]
      // Rule: Rootbotics 5.5 — resolve the Decree, then build.
      case 'daylight':
        return decreeTasks(state, seat)
      // Rule: Rootbotics 5.6 — score the Roosts track.
      case 'evening':
        return [{ kind: 'scoreRoosts' }]
    }
  }

  protected runTask(state: GameState, task: BotTask, ctx: Ctx): BotTaskResult {
    const seat = state.currentSeat
    switch (task.kind) {
      case 'revealOrder':
        return taskDone(revealOrderCard(state, seat, ctx))
      case 'craftOrder':
        return taskDone(craftOrderCard(state, seat, ctx))
      case 'addToDecree':
        addOrderToDecree(state, seat)
        return taskDone()
      case 'newRoost':
        return newRoost(state, seat)
      case 'decreeRecruit':
        return decreeRecruit(state, task.column)
      case 'decreeMove':
        return decreeMove(state, task.column, ctx)
      case 'decreeBattle':
        return decreeBattle(state, task.column, ctx)
      case 'buildRoost':
        return buildRoost(state, seat, ctx)
      case 'scoreRoosts':
        return taskDone(scoreRoosts(state, seat, ctx))
      default:
        return taskDone()
    }
  }
}

export const ELECTRIC_EYRIE = new ElectricEyrie()
