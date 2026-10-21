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
  type BotPlacement,
} from '#factions/bots/botQueries.js'
import { botHasTrait } from '#factions/bots/botSettings.js'
import {
  challengingRecruit,
  escalatedWarriorsPerClearing,
  maximumExpandCount,
  recruitedWarriors,
  scoreOverwhelming,
  warriorSupply,
} from '#factions/bots/mechanicalMarquise/cards.js'
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

/** Rule: Rootbotics 4.7.2 — the two lowest-priority ruled clearings. */
const ESCALATED_RECRUIT_CLEARINGS = 2
/** Rule: Rootbotics 4.5.4 / 4.7.4 — warriors left behind when moving out. */
const WARRIORS_LEFT_BEHIND = 3
/** Trait Blitz — "Move all but one warrior from the clearing". */
const BLITZ_WARRIORS_LEFT_BEHIND = 1
/** Rule: Rootbotics 4.5.5 — Expand only with five or fewer buildings on the map. */
const MAXIMUM_BUILDINGS_TO_EXPAND = 5

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
  // Trait Blitz — one more move (and battle) after the move action.
  const blitz: MechanicalMarquiseTask[] = botHasTrait(state, seat, 'blitz')
    ? [{ kind: 'blitz' }]
    : []
  if (suit === 'bird') {
    return [
      ...allClearingsByPriority().map(
        (clearing: ClearingId): MechanicalMarquiseTask => ({ kind: 'battle', clearing }),
      ),
      { kind: 'escalatedRecruit' },
      { kind: 'escalatedBuild' },
      { kind: 'escalatedMoves' },
      ...blitz,
    ]
  }
  const ordered = orderedByPriority(suit)
  return [
    ...ordered.map((clearing: ClearingId): MechanicalMarquiseTask => ({ kind: 'battle', clearing })),
    { kind: 'recruit' },
    { kind: 'build' },
    ...ordered.map((clearing: ClearingId): MechanicalMarquiseTask => ({ kind: 'move', clearing })),
    ...blitz,
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
 * A Recruit action: place, then Overwhelming scores what could not be
 * placed and Challenging / Nightmare add their two warriors.
 */
function finishRecruit(
  state: GameState,
  recruit: { seat: Seat; requested: number; placements: BotPlacement[] },
  ctx: Ctx,
): BotTaskResult {
  const { seat, requested, placements } = recruit
  const supplyBefore = warriorSupply(state, seat)
  const logs: LogEntry[] = placements.flatMap((placement: BotPlacement): LogEntry[] =>
    placeBotWarriors(state, placement),
  )
  const placed = supplyBefore - warriorSupply(state, seat)
  logs.push(...scoreOverwhelming(state, { seat, unplaced: requested - placed }, ctx))
  const suit = orderSuitOf(mechanicalMarquiseBoardOf(state, seat))
  if (suit !== null) logs.push(...challengingRecruit(state, { seat, suit }, ctx))
  return taskDone(logs)
}

/**
 * Rule: Rootbotics 4.5.2 — four warriors (Easy: two) evenly among ordered
 * clearings it rules; what does not split evenly goes to the highest priority first.
 */
function recruit(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const suit = orderSuitOf(mechanicalMarquiseBoardOf(state, seat))
  if (suit === null) return taskDone()
  const ruled = ruledClearings(state, seat, ctx)
  const clearings = orderedByPriority(suit).filter((clearing: ClearingId): boolean =>
    ruled.includes(clearing),
  )
  const requested = recruitedWarriors(state, seat)
  const evenShare = clearings.length === 0 ? 0 : Math.floor(requested / clearings.length)
  const remainder = clearings.length === 0 ? 0 : requested % clearings.length
  const placements = clearings.map(
    (clearing: ClearingId, index: number): BotPlacement => ({
      seat,
      clearing,
      count: evenShare + (index < remainder ? 1 : 0),
    }),
  )
  return finishRecruit(state, { seat, requested, placements }, ctx)
}

/**
 * Rule: Rootbotics 4.7.2 — two warriors in each of the two lowest-priority
 * ruled clearings, all in one if it rules one (Easy halves, Iron Will doubles).
 */
function escalatedRecruit(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const clearings = inTargetOrder(ruledClearings(state, seat, ctx), [byLowestPriority])
  const perClearing = escalatedWarriorsPerClearing(state, seat)
  const requested = perClearing * ESCALATED_RECRUIT_CLEARINGS
  const placements: BotPlacement[] =
    clearings.length === 1
      ? [{ seat, clearing: clearings[0]!, count: requested }]
      : clearings.slice(0, ESCALATED_RECRUIT_CLEARINGS).map(
          (clearing: ClearingId): BotPlacement => ({ seat, clearing, count: perClearing }),
        )
  return finishRecruit(state, { seat, requested, placements }, ctx)
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
  move: { seat: Seat; origin: ClearingId; leftBehind?: number },
  ctx: Ctx,
): { logs: LogEntry[]; destination: ClearingId | null } {
  const { seat, origin } = move
  const count = warriors(state, origin, seat) - (move.leftBehind ?? WARRIORS_LEFT_BEHIND)
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
 * Trait Blitz — from the highest-priority ruled clearing with no enemy piece,
 * all but one warrior move like 4.5.4; battle there if opponents are present.
 */
function blitz(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const ruled = ruledClearings(state, seat, ctx)
  const origins = allClearingsByPriority().filter(
    (clearing: ClearingId): boolean =>
      ruled.includes(clearing) && enemyPieceCount(state, clearing, seat) === 0,
  )
  for (const origin of origins) {
    const moved = moveOut(state, { seat, origin, leftBehind: BLITZ_WARRIORS_LEFT_BEHIND }, ctx)
    if (moved.destination === null) continue
    return {
      logs: moved.logs,
      followUps: [{ kind: 'battle', clearing: moved.destination }],
    }
  }
  return taskDone()
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
    expandCount >= maximumExpandCount(state, seat)
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
    case 'blitz':
      return blitz(state, seat, ctx)
    default:
      return taskDone()
  }
}
