import { BotFaction, taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { scoreNightmareEvening } from '#factions/bots/botSettings.js'
import {
  craftOrderCard,
  discardOrderCard,
  revealOrderCard,
} from '#factions/bots/orderCard.js'
import {
  adventurerQuests,
  aid,
  explore,
  quest,
  repair,
} from '#factions/bots/vagabot/actions.js'
import { battle, battleAgain } from '#factions/bots/vagabot/battleAction.js'
import { aidSettings, questVictoryPoints, refreshBonus } from '#factions/bots/vagabot/cards.js'
import { special } from '#factions/bots/vagabot/characters.js'
import { repairOneItem } from '#factions/bots/vagabot/items.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { botHasTrait } from '#factions/bots/botSettings.js'
import { placeVagabotSetup } from '#factions/bots/vagabot/setup.js'
import {
  daylightTasks,
  eveningRepair,
  refresh,
  slip,
} from '#factions/bots/vagabot/turn.js'
import type { Ctx } from '#game/ctx.js'
import type { Seat } from '#pieces/types.js'
import type { BotTask } from '#state/botTurn.js'
import type { GameState, Phase, Step } from '#state/types.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['order'],
  daylight: ['actions'],
  evening: ['rest'],
}

const BERSERKER_REPAIR: BotTask = { kind: 'berserkerRepair' }

/** Rule: Rootbotics 7 — Vagabot. Plays its turn by itself. */
export class Vagabot extends BotFaction {
  readonly id = 'vagabot' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, ctx: Ctx): void {
    placeVagabotSetup(state, seat, ctx.rng)
  }

  protected planStep(state: GameState, seat: Seat): BotTask[] {
    switch (state.phase) {
      // Rule: Rootbotics 7.4 — reveal, craft, slip.
      case 'birdsong':
        return [{ kind: 'revealOrder' }, { kind: 'craftOrder' }, { kind: 'slip' }]
      // Rule: Rootbotics 7.5 — the Daylight Actions of the order suit.
      case 'daylight':
        return daylightTasks(state, seat)
      // Rule: Rootbotics 7.6 — refresh, repair, discard; Nightmare's point,
      // then Berserker's repair at the end of the turn.
      case 'evening':
        return [
          { kind: 'refresh' },
          { kind: 'eveningRepair' },
          { kind: 'discardOrder' },
          { kind: 'nightmareScore' },
          ...(botHasTrait(state, seat, 'berserker') ? [BERSERKER_REPAIR] : []),
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
      case 'slip':
        return slip(state, seat, ctx)
      case 'explore':
        return explore(state, seat, ctx)
      case 'quest':
        return quest(state, { seat, points: questVictoryPoints(state, seat) }, ctx)
      case 'adventurerQuests':
        return adventurerQuests(state, { seat, points: questVictoryPoints(state, seat) }, ctx)
      case 'aid':
        return aid(state, { seat, ...aidSettings(state, seat) }, ctx)
      case 'battleTarget':
        return battle(state, seat, ctx)
      case 'battleAgain':
        return battleAgain(
          state,
          { seat, clearing: task.clearing, defender: task.defender },
          ctx,
        )
      case 'repair':
        return repair(state, seat)
      case 'special':
        return special(state, seat, ctx)
      case 'refresh':
        return taskDone(refresh(state, { seat, difficultyBonus: refreshBonus(state, seat) }))
      case 'eveningRepair':
        return taskDone(eveningRepair(state, seat))
      case 'berserkerRepair':
        repairOneItem(vagabotBoardOf(state, seat))
        return taskDone()
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

export const VAGABOT = new Vagabot()
