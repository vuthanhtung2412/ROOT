import type { Action, ActionSpec, ResolveEventAction } from '../actions/types.js'
import { assignEyrieLeader } from '../factions/Eyrie.js'
import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import type { Seat } from '../pieces/types.js'
import { playerOf } from '../queries/seat.js'
import { RuleError } from '../rules/RuleError.js'
import type { EyrieLeader } from '../state/boards.js'
import type { GameState } from '../state/types.js'
import type { ChooseLeaderEvent } from './types.js'

export type ChooseLeaderApply = {
  event: ChooseLeaderEvent
  action: ResolveEventAction
  actor: Seat
}

export type ChooseLeaderResolver = {
  legalActions(state: GameState, event: ChooseLeaderEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: ChooseLeaderApply, ctx: Ctx): LogEntry[]
  matchesAction(
    state: GameState,
    event: ChooseLeaderEvent,
    action: Action,
    ctx: Ctx,
  ): boolean
}

function isEyrieLeader(value: string): value is EyrieLeader {
  return (
    value === 'builder' ||
    value === 'charismatic' ||
    value === 'commander' ||
    value === 'despot'
  )
}

export const chooseLeaderResolver: ChooseLeaderResolver = {
  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    if (action.leader === undefined || !isEyrieLeader(action.leader)) return false
    return this.legalActions(state, event, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent' || spec.actor !== event.seat) return false
      return spec.params?.leaders?.includes(action.leader!) === true
    })
  },

  legalActions(state, event, _ctx) {
    const board = playerOf(state, event.seat).board
    if (board.kind !== 'eyrie') return []
    return [
      {
        type: 'resolveEvent',
        actor: event.seat,
        params: { leaders: [...board.leadersFaceUp] },
      },
    ]
  },

  apply(state, { event, action, actor }, _ctx) {
    if (actor !== event.seat) throw new RuleError('WRONG_ACTOR', { actor })
    if (action.leader === undefined || !isEyrieLeader(action.leader)) {
      throw new RuleError('MISSING_LEADER')
    }

    const board = playerOf(state, event.seat).board
    if (board.kind !== 'eyrie') throw new RuleError('NOT_EYRIE', { seat: event.seat })

    const pendingIndex = state.pending.indexOf(event)
    if (pendingIndex >= 0) state.pending.splice(pendingIndex, 1)

    assignEyrieLeader(board, action.leader)

    const logs: LogEntry[] = [{ t: 'event', event }]
    if (event.reason === 'depose') {
      // Rule: 7.7.4 Rest — end Daylight → Evening score.
      state.phase = 'evening'
      state.step = 'score'
      logs.push({ t: 'phase', actor: event.seat, phase: 'evening', step: 'score' })
    }
    return logs
  },
}
