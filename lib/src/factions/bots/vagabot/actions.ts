import { questDefOf } from '#cards/quests.js'
import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { isBotSeat } from '#factions/bots/botFactions.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { byFewest, bySetupPriority, inTargetOrder } from '#factions/bots/priority.js'
import {
  damagedItems,
  exhaustItems,
  exhaustibleItemCount,
  gainItem,
  repairOneItem,
} from '#factions/bots/vagabot/items.js'
import { travelToAct, vagabotClearing } from '#factions/bots/vagabot/pawn.js'
import { drawCards } from '#factions/sharedTurn.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { CraftedItem, PlayerState } from '#state/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { piecesIn } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { randomIndex } from '#rules/Rng.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 7.5.1 — one item to explore. */
const EXPLORE_COST = 1
/** Rule: Rootbotics 7.5.2 — two items to complete a quest. */
const QUEST_COST = 2
/** Rule: Rootbotics 7.5.2 — a completed quest scores one point. */
export const QUEST_VICTORY_POINTS = 1
/** Rule: Rootbotics 7.5.5 — one item to repair. */
const REPAIR_COST = 1
/** Rule: Rootbotics 7.5.3 — an aided bot scores one point (2.8.1). */
const AIDED_BOT_VICTORY_POINTS = 1

export type VagabotScore = {
  seat: Seat
  points: number
  reason: string
}

export function scoreVagabot(state: GameState, score: VagabotScore, ctx: Ctx): LogEntry[] {
  const scored = addVictoryPoints(state, score.seat, score.points)
  if (scored === 0) return []
  ctx.emit({ s: 'vp', actor: score.seat, delta: scored })
  return [{ t: 'vp', actor: score.seat, delta: scored, reason: score.reason }]
}

function hasRuinItems(state: GameState, clearing: ClearingId): boolean {
  return (state.clearings[clearing]?.ruin?.items.length ?? 0) > 0
}

/**
 * Rule: Rootbotics 7.5.1 Explore — to the nearest ruin, exhaust one item,
 * take a random item from it (the empty ruin is removed). No points.
 */
export function explore(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const travel = travelToAct(state, {
    seat,
    canActIn: (clearing: ClearingId): boolean => hasRuinItems(state, clearing),
  })
  if (travel.clearing === null) return taskDone(travel.logs)
  const board = vagabotBoardOf(state, seat)
  const clearingState = state.clearings[travel.clearing]!
  const ruin = clearingState.ruin
  if (ruin === undefined || !exhaustItems(board, EXPLORE_COST)) return taskDone(travel.logs)
  const [item] = ruin.items.splice(randomIndex(ctx.rng, ruin.items.length), 1)
  if (item === undefined) return taskDone(travel.logs)
  gainItem(board, item)
  if (ruin.items.length === 0) delete clearingState.ruin
  return taskDone([
    ...travel.logs,
    { t: 'action', actor: seat, action: { type: 'botExplore', clearing: travel.clearing, item } },
  ])
}

/**
 * Rule: Rootbotics 7.5.2 Quest — to the nearest clearing of the quest's
 * suit, exhaust two items, score a point, draw a new quest.
 */
export function quest(
  state: GameState,
  questing: { seat: Seat; points: number },
  ctx: Ctx,
): BotTaskResult {
  const { seat } = questing
  const board = vagabotBoardOf(state, seat)
  const current = board.quest
  if (current === null) return taskDone()
  const suit = questDefOf(current).suit
  const travel = travelToAct(state, {
    seat,
    canActIn: (clearing: ClearingId): boolean => FALL.clearings[clearing]!.suit === suit,
  })
  if (travel.clearing === null || !exhaustItems(board, QUEST_COST)) return taskDone(travel.logs)
  board.quest = state.questDeck.pop() ?? null
  return taskDone([
    ...travel.logs,
    { t: 'action', actor: seat, action: { type: 'botQuest', clearing: travel.clearing } },
    ...scoreVagabot(state, { seat, points: questing.points, reason: 'quest' }, ctx),
  ])
}

function hasPieceIn(state: GameState, clearing: ClearingId, seat: Seat): boolean {
  return piecesIn(state, clearing).some((piece: Piece): boolean => piece.owner === seat)
}

/** Rule: Rootbotics 7.5.3 — players in the clearing with a crafted item, fewest points first. */
export function aidTargets(state: GameState, seat: Seat, clearing: ClearingId): Seat[] {
  const candidates = state.players
    .filter(
      (other: PlayerState): boolean =>
        other.seat !== seat &&
        other.craftedItems.length > 0 &&
        hasPieceIn(state, clearing, other.seat),
    )
    .map((other: PlayerState): Seat => other.seat)
  return inTargetOrder(candidates, [
    byFewest((candidate: Seat): number => playerOf(state, candidate).vp),
    bySetupPriority(state),
  ])
}

export type Aid = {
  seat: Seat
  target: Seat
  /** Trait Helper — extra point for the Vagabot, cards per item for a human. */
  bonusVictoryPoints: number
  cardsPerItem: number
}

/**
 * Rule: Rootbotics 7.5.3 Aid — exhaust up to the target's crafted items,
 * take that many, score that many; the target draws that many cards
 * (an aided bot scores one point instead, 2.8.1).
 */
export function aidPlayer(state: GameState, aid: Aid, ctx: Ctx): LogEntry[] {
  const { seat, target } = aid
  const board = vagabotBoardOf(state, seat)
  const targetPlayer = playerOf(state, target)
  const count = Math.min(exhaustibleItemCount(board), targetPlayer.craftedItems.length)
  if (count === 0 || !exhaustItems(board, count)) return []
  const taken: CraftedItem[] = targetPlayer.craftedItems.slice(0, count)
  targetPlayer.craftedItems = targetPlayer.craftedItems.slice(count)
  for (const item of taken) gainItem(board, item.type)
  const logs: LogEntry[] = [
    { t: 'action', actor: seat, action: { type: 'botAid', target, count } },
    ...scoreVagabot(
      state,
      { seat, points: count + aid.bonusVictoryPoints, reason: 'aid' },
      ctx,
    ),
  ]
  if (isBotSeat(state, target)) {
    return [
      ...logs,
      ...scoreVagabot(state, { seat: target, points: AIDED_BOT_VICTORY_POINTS, reason: 'aided' }, ctx),
    ]
  }
  drawCards(state, { seat: target, count: count * aid.cardsPerItem }, ctx)
  return logs
}

/** Rule: Rootbotics 7.5.3 — aid in the Vagabot's clearing (no move). */
export function aid(
  state: GameState,
  aiding: { seat: Seat; bonusVictoryPoints: number; cardsPerItem: number },
  ctx: Ctx,
): BotTaskResult {
  const clearing = vagabotClearing(state, aiding.seat)
  if (clearing === null) return taskDone()
  const [target] = aidTargets(state, aiding.seat, clearing)
  if (target === undefined) return taskDone()
  return taskDone(aidPlayer(state, { ...aiding, target }, ctx))
}

/** Rule: Rootbotics 7.5.5 Repair — exhaust one item to repair one. */
export function repair(state: GameState, seat: Seat): BotTaskResult {
  const board = vagabotBoardOf(state, seat)
  if (damagedItems(board).length === 0 || !exhaustItems(board, REPAIR_COST)) return taskDone()
  repairOneItem(board)
  return taskDone([{ t: 'action', actor: seat, action: { type: 'botRepair' } }])
}
