import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { isEnemyOfBot, startBotBattle } from '#factions/bots/botQueries.js'
import {
  byFewest,
  byMost,
  byMostVictoryPoints,
  bySetupPriority,
  inTargetOrder,
} from '#factions/bots/priority.js'
import { exhaustItems } from '#factions/bots/vagabot/items.js'
import { travelToAct, vagabotClearing } from '#factions/bots/vagabot/pawn.js'
import type { Ctx } from '#game/ctx.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { piecesIn } from '#queries/pieces.js'
import type { VagabotTask } from '#state/botTurn.js'
import type { GameState, PlayerState } from '#state/types.js'

/** Rule: Rootbotics 7.5.4 — one item for the first battle. */
const FIRST_BATTLE_COST = 1
/** Rule: Rootbotics 7.5.4 — two items for each battle again. */
const REPEATED_BATTLE_COST = 2

export type VagabotBattle = {
  seat: Seat
  clearing: ClearingId
  defender: Seat
}

function piecesOf(state: GameState, clearing: ClearingId, owner: Seat): Piece[] {
  return piecesIn(state, clearing).filter((piece: Piece): boolean => piece.owner === owner)
}

function hasPieceOnMap(state: GameState, owner: Seat): boolean {
  return state.clearings.some((_clearing, clearing: ClearingId): boolean =>
    piecesOf(state, clearing, owner).length > 0,
  )
}

/** Rule: Rootbotics 7.5.4 — the enemy with the most points that has a piece on the map. */
export function battleTargetPlayer(state: GameState, seat: Seat): Seat | null {
  const enemies = state.players
    .map((player: PlayerState): Seat => player.seat)
    .filter(
      (other: Seat): boolean => isEnemyOfBot(state, seat, other) && hasPieceOnMap(state, other),
    )
  return inTargetOrder(enemies, [byMostVictoryPoints(state), bySetupPriority(state)])[0] ?? null
}

/** Open one battle and queue the next one (7.5.4 — repeat while it can pay). */
function battleThere(state: GameState, battle: VagabotBattle, ctx: Ctx): BotTaskResult {
  const next: VagabotTask = { kind: 'battleAgain', clearing: battle.clearing, defender: battle.defender }
  return {
    logs: startBotBattle(state, battle, ctx),
    followUps: [next],
  }
}

/**
 * Rule: Rootbotics 7.5.4 Battle — to the nearest clearing with a piece of
 * the target (I: most buildings and tokens, II: fewest warriors), exhaust
 * one item and battle.
 */
export function battle(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const defender = battleTargetPlayer(state, seat)
  if (defender === null) return taskDone()
  const travel = travelToAct(state, {
    seat,
    canActIn: (clearing: ClearingId): boolean => piecesOf(state, clearing, defender).length > 0,
    tiebreakers: [
      byMost(
        (clearing: ClearingId): number =>
          piecesOf(state, clearing, defender).filter(
            (piece: Piece): boolean => piece.kind === 'building' || piece.kind === 'token',
          ).length,
      ),
      byFewest(
        (clearing: ClearingId): number =>
          piecesOf(state, clearing, defender).filter(
            (piece: Piece): boolean => piece.kind === 'warrior',
          ).length,
      ),
    ],
  })
  if (travel.clearing === null) return taskDone(travel.logs)
  if (!exhaustItems(vagabotBoardOf(state, seat), FIRST_BATTLE_COST)) return taskDone(travel.logs)
  const opened = battleThere(state, { seat, clearing: travel.clearing, defender }, ctx)
  return { logs: [...travel.logs, ...opened.logs], followUps: opened.followUps }
}

/** Rule: Rootbotics 7.5.4 — pieces of the target remain: two items, battle again. */
export function battleAgain(state: GameState, battle: VagabotBattle, ctx: Ctx): BotTaskResult {
  if (vagabotClearing(state, battle.seat) !== battle.clearing) return taskDone()
  if (piecesOf(state, battle.clearing, battle.defender).length === 0) return taskDone()
  if (!exhaustItems(vagabotBoardOf(state, battle.seat), REPEATED_BATTLE_COST)) return taskDone()
  return battleThere(state, battle, ctx)
}
