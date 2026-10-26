import { BotFaction, taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { botHasTrait, scoreNightmareEvening } from '#factions/bots/botSettings.js'
import { organizeWarriors } from '#factions/bots/automatedAlliance/cards.js'
import { spreadSympathy } from '#factions/bots/automatedAlliance/sympathy.js'
import {
  birdsongRevolt,
  organize,
  publicPity,
  recruitAtBases,
  surpriseRevolt,
} from '#factions/bots/automatedAlliance/turn.js'
import {
  craftOrderCard,
  discardOrderCard,
  revealOrderCard,
} from '#factions/bots/orderCard.js'
import type { Ctx } from '#game/ctx.js'
import type { Seat } from '#pieces/types.js'
import type { BotTask } from '#state/botTurn.js'
import type { GameState, Phase, Step } from '#state/types.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['order'],
  daylight: ['actions'],
  evening: ['organize'],
}

const WILDFIRE: BotTask = { kind: 'wildfire' }

/** Rule: Rootbotics 6 — Automated Alliance. Plays its turn by itself. */
export class AutomatedAlliance extends BotFaction {
  readonly id = 'automatedAlliance' as const
  readonly steps = STEPS

  /** Rule: Rootbotics 6.3 — bases and sympathy start on the board. */
  setup(_state: GameState, _seat: Seat, _ctx: Ctx): void {}

  protected planStep(state: GameState, seat: Seat): BotTask[] {
    switch (state.phase) {
      // Rule: Rootbotics 6.4 — reveal, craft, revolt, Public Pity.
      case 'birdsong':
        return [
          { kind: 'revealOrder' },
          { kind: 'craftOrder' },
          { kind: 'revolt' },
          { kind: 'publicPity' },
        ]
      // Rule: Rootbotics 6.5 — spread sympathy, then a Surprise Revolt on a bird.
      case 'daylight':
        return [{ kind: 'spreadSympathy' }, { kind: 'surpriseRevolt' }]
      // Rule: Rootbotics 6.6 — organize, recruit, discard (Wildfire spreads
      // with the order still known); Nightmare's point last.
      case 'evening':
        return [
          { kind: 'organize' },
          { kind: 'recruit' },
          ...(botHasTrait(state, seat, 'wildfire') ? [WILDFIRE] : []),
          { kind: 'discardOrder' },
          { kind: 'nightmareScore' },
        ]
    }
  }

  protected runTask(state: GameState, task: BotTask, ctx: Ctx): BotTaskResult {
    const seat = state.currentSeat
    switch (task.kind) {
      case 'revealOrder':
        return taskDone(revealOrderCard(state, seat, ctx))
      case 'craftOrder':
        return taskDone(craftOrderCard(state, seat, ctx))
      case 'revolt':
        return birdsongRevolt(state, seat, ctx)
      case 'publicPity':
        return publicPity(state, seat)
      case 'spreadSympathy':
        return taskDone(spreadSympathy(state, { seat, scores: true }, ctx))
      case 'surpriseRevolt':
        return surpriseRevolt(state, seat, ctx)
      case 'organize':
        return taskDone(organize(state, { seat, threshold: organizeWarriors(state, seat) }, ctx))
      case 'wildfire':
        return taskDone(spreadSympathy(state, { seat, scores: false }, ctx))
      case 'recruit':
        return taskDone(recruitAtBases(state, seat))
      case 'discardOrder':
        discardOrderCard(state, seat)
        return taskDone()
      case 'nightmareScore':
        return taskDone(scoreNightmareEvening(state, seat, ctx))
      default:
        return taskDone()
    }
  }
}

export const AUTOMATED_ALLIANCE = new AutomatedAlliance()
