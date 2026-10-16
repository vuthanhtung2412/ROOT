import type { CardSuit } from '#cards/types.js'
import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { mechanicalMarquiseBoardOf } from '#factions/bots/botBoards.js'
import {
  canBotMove,
  defendersInOrder,
  enemyPieceCount,
  moveBotWarriors,
  pieceCountOf,
  placeBotWarriors,
  ruledClearings,
  startBotBattle,
} from '#factions/bots/botQueries.js'
import {
  BUILDING_OF_SUIT,
  buildingsOnMap,
  escalatedBuildingType,
  placeBotBuilding,
} from '#factions/bots/mechanicalMarquise/buildings.js'
import {
  discardOrderCard,
  orderSuitOf,
  orderedClearings,
  revealOrderCard,
} from '#factions/bots/orderCard.js'
import {
  byHighestPriority,
  byLowestPriority,
  byMost,
  byMostVictoryPoints,
  bySetupPriority,
  inTargetOrder,
} from '#factions/bots/priority.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import type { MechanicalMarquiseTask } from '#state/botTurn.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 4.5.2 — warriors placed by Recruit. */
const RECRUITED_WARRIORS = 4
/** Rule: Rootbotics 4.7.2 — warriors in each of the two lowest-priority clearings. */
const ESCALATED_RECRUIT_PER_CLEARING = 2
const ESCALATED_RECRUIT_CLEARINGS = 2
/** Rule: Rootbotics 4.5.4 / 4.7.4 — warriors left behind when moving out. */
const WARRIORS_LEFT_BEHIND = 3
/** Rule: Rootbotics 4.5.5 — Expand only with five or fewer buildings on the map. */
const MAXIMUM_BUILDINGS_TO_EXPAND = 5
/**
 * House rule: Expand (4.5.5) repeats while no building is placed, which never
 * ends when no building can be placed anywhere. At most this many per turn.
 */
export const MAXIMUM_EXPAND_COUNT = 3

function allClearingsByPriority(): ClearingId[] {
  return inTargetOrder(
    FALL.clearings.map((clearing): ClearingId => clearing.id),
    [byHighestPriority],
  )
}

function orderedByPriority(suit: CardSuit): ClearingId[] {
  return inTargetOrder(orderedClearings(suit), [byHighestPriority])
}

/** Rule: Rootbotics 4.5 / 4.7 — Daylight, or Escalated Daylight on a bird. */
export function daylightTasks(state: GameState, seat: Seat): MechanicalMarquiseTask[] {
  const suit = orderSuitOf(mechanicalMarquiseBoardOf(state, seat))
  if (suit === null) return []
  if (suit === 'bird') {
    return [
      ...allClearingsByPriority().map(
        (clearing: ClearingId): MechanicalMarquiseTask => ({ kind: 'battle', clearing }),
      ),
      { kind: 'escalatedRecruit' },
      { kind: 'escalatedBuild' },
      { kind: 'escalatedMoves' },
    ]
  }
  const ordered = orderedByPriority(suit)
  return [
    ...ordered.map((clearing: ClearingId): MechanicalMarquiseTask => ({ kind: 'battle', clearing })),
    { kind: 'recruit' },
    { kind: 'build' },
    ...ordered.map((clearing: ClearingId): MechanicalMarquiseTask => ({ kind: 'move', clearing })),
    { kind: 'expand' },
  ]
}

/** Rule: Rootbotics 4.5.1 / 4.7.1 — defender: most pieces, then most points. */
function battle(state: GameState, seat: Seat, clearing: ClearingId, ctx: Ctx): BotTaskResult {
  const [defender] = defendersInOrder(state, { seat, clearing }, [
    byMost((candidate: Seat): number => pieceCountOf(state, clearing, candidate)),
    byMostVictoryPoints(state),
    bySetupPriority(state),
  ])
  if (defender === undefined) return taskDone()
  return taskDone(startBotBattle(state, { seat, clearing, defender }, ctx))
}

/**
 * Rule: Rootbotics 4.5.2 — four warriors evenly among ordered clearings it
 * rules; what does not split evenly goes to the highest priority first.
 */
function recruit(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const suit = orderSuitOf(mechanicalMarquiseBoardOf(state, seat))
  if (suit === null) return taskDone()
  const ruled = ruledClearings(state, seat, ctx)
  const clearings = orderedByPriority(suit).filter((clearing: ClearingId): boolean =>
    ruled.includes(clearing),
  )
  if (clearings.length === 0) return taskDone()
  const evenShare = Math.floor(RECRUITED_WARRIORS / clearings.length)
  const remainder = RECRUITED_WARRIORS % clearings.length
  const logs: LogEntry[] = clearings.flatMap((clearing: ClearingId, index: number): LogEntry[] =>
    placeBotWarriors(state, {
      seat,
      clearing,
      count: evenShare + (index < remainder ? 1 : 0),
    }),
  )
  return taskDone(logs)
}

/** Rule: Rootbotics 4.7.2 — two warriors in each of the two lowest-priority ruled clearings. */
function escalatedRecruit(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const clearings = inTargetOrder(ruledClearings(state, seat, ctx), [byLowestPriority])
  if (clearings.length === 0) return taskDone()
  if (clearings.length === 1) {
    return taskDone(
      placeBotWarriors(state, { seat, clearing: clearings[0]!, count: RECRUITED_WARRIORS }),
    )
  }
  return taskDone(
    clearings.slice(0, ESCALATED_RECRUIT_CLEARINGS).flatMap(
      (clearing: ClearingId): LogEntry[] =>
        placeBotWarriors(state, { seat, clearing, count: ESCALATED_RECRUIT_PER_CLEARING }),
    ),
  )
}

/** Adjacent clearings in move order: most enemy pieces, then highest priority. */
function destinationsInOrder(state: GameState, seat: Seat, origin: ClearingId): ClearingId[] {
  return inTargetOrder(FALL.adjacent(origin), [
    byMost((clearing: ClearingId): number => enemyPieceCount(state, clearing, seat)),
    byHighestPriority,
  ])
}

/**
 * Rule: Rootbotics 4.5.4 / 4.7.4 — move all but three warriors to the adjacent
 * clearing with the most enemy pieces. Returns where they went.
 */
function moveOut(
  state: GameState,
  move: { seat: Seat; origin: ClearingId },
  ctx: Ctx,
): { logs: LogEntry[]; destination: ClearingId | null } {
  const { seat, origin } = move
  const count = warriors(state, origin, seat) - WARRIORS_LEFT_BEHIND
  if (count < 1) return { logs: [], destination: null }
  const destination = destinationsInOrder(state, seat, origin).find(
    (candidate: ClearingId): boolean =>
      canBotMove(state, { seat, from: origin, to: candidate, count }, ctx),
  )
  if (destination === undefined) return { logs: [], destination: null }
  return {
    logs: moveBotWarriors(state, { seat, from: origin, to: destination, count }, ctx),
    destination,
  }
}

/** Rule: Rootbotics 4.7.4 — move out of every clearing, then battle where it moved in. */
function escalatedMoves(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const logs: LogEntry[] = []
  const movedInto: ClearingId[] = []
  for (const origin of allClearingsByPriority()) {
    const moved = moveOut(state, { seat, origin }, ctx)
    logs.push(...moved.logs)
    if (moved.destination !== null && !movedInto.includes(moved.destination)) {
      movedInto.push(moved.destination)
    }
  }
  return {
    logs,
    followUps: inTargetOrder(movedInto, [byHighestPriority]).map(
      (clearing: ClearingId): MechanicalMarquiseTask => ({ kind: 'battle', clearing }),
    ),
  }
}

/**
 * Rule: Rootbotics 4.5.5 — no building placed this turn and five or fewer on
 * the map: a new order card (no craft) and Daylight again.
 */
function expand(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const expandCount = state.turnScratch.botExpandCount ?? 0
  if (
    state.turnScratch.botBuiltThisTurn === true ||
    buildingsOnMap(state, seat) > MAXIMUM_BUILDINGS_TO_EXPAND ||
    expandCount >= MAXIMUM_EXPAND_COUNT
  ) {
    return taskDone()
  }
  state.turnScratch.botExpandCount = expandCount + 1
  discardOrderCard(state, seat)
  const logs = revealOrderCard(state, seat, ctx)
  return { logs, followUps: daylightTasks(state, seat) }
}

export function runMechanicalMarquiseDaylightTask(
  state: GameState,
  task: MechanicalMarquiseTask,
  ctx: Ctx,
): BotTaskResult {
  const seat = state.currentSeat
  const suit = orderSuitOf(mechanicalMarquiseBoardOf(state, seat))
  switch (task.kind) {
    case 'battle':
      return battle(state, seat, task.clearing, ctx)
    case 'recruit':
      return recruit(state, seat, ctx)
    case 'build':
      if (suit === null || suit === 'bird') return taskDone()
      return taskDone(placeBotBuilding(state, { seat, building: BUILDING_OF_SUIT[suit] }, ctx))
    case 'move':
      return taskDone(moveOut(state, { seat, origin: task.clearing }, ctx).logs)
    case 'expand':
      return expand(state, seat, ctx)
    case 'escalatedRecruit':
      return escalatedRecruit(state, seat, ctx)
    case 'escalatedBuild':
      return taskDone(
        placeBotBuilding(state, { seat, building: escalatedBuildingType(state, seat) }, ctx),
      )
    case 'escalatedMoves':
      return escalatedMoves(state, seat, ctx)
    default:
      return taskDone()
  }
}
