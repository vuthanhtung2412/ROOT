import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { enemyPieceCount, isEnemyOfBot, startBotBattle } from '#factions/bots/botQueries.js'
import { botHasTrait } from '#factions/bots/botSettings.js'
import {
  byFewest,
  byHighestPriority,
  byMost,
  byMostVictoryPoints,
  bySetupPriority,
  inTargetOrder,
} from '#factions/bots/priority.js'
import { scoreVagabot } from '#factions/bots/vagabot/actions.js'
import { exhaustItems } from '#factions/bots/vagabot/items.js'
import { travelToAct, vagabotClearing, type PawnTravel } from '#factions/bots/vagabot/pawn.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { piecesIn } from '#queries/pieces.js'
import { removePieces } from '#rules/remove.js'
import type { VagabotTask } from '#state/botTurn.js'
import type { GameState, PlayerState } from '#state/types.js'

/** Rule: Rootbotics 7.5.4 — one item for the first battle. */
const FIRST_BATTLE_COST = 1
/** Rule: Rootbotics 7.5.4 — two items for each battle again. */
const REPEATED_BATTLE_COST = 2
/** Trait Marksman — one immediate hit; a point if it removes a warrior. */
const MARKSMAN_HITS = 1
const MARKSMAN_WARRIOR_VICTORY_POINTS = 1

export type VagabotBattle = {
  seat: Seat
  clearing: ClearingId
  defender: Seat
}

type BattlePlan = {
  defender: Seat
  travel: PawnTravel
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

/**
 * Rule: Rootbotics 7.5.4 — the nearest clearing with a piece of the target;
 * I: most of its buildings and tokens, II: fewest of its warriors.
 */
function leaderBattlePlan(state: GameState, seat: Seat): BattlePlan | null {
  const defender = battleTargetPlayer(state, seat)
  if (defender === null) return null
  const count = (clearing: ClearingId, matches: (piece: Piece) => boolean): number =>
    piecesOf(state, clearing, defender).filter(matches).length
  return {
    defender,
    travel: {
      seat,
      canActIn: (clearing: ClearingId): boolean => piecesOf(state, clearing, defender).length > 0,
      tiebreakers: [
        byMost((clearing: ClearingId): number =>
          count(clearing, (piece: Piece): boolean => piece.kind === 'building' || piece.kind === 'token'),
        ),
        byFewest((clearing: ClearingId): number =>
          count(clearing, (piece: Piece): boolean => piece.kind === 'warrior'),
        ),
      ],
    },
  }
}

/** Trait Berserker — the clearing with the most pieces, the player with the most there. */
function berserkerBattlePlan(state: GameState, seat: Seat): BattlePlan | null {
  const clearings = FALL.clearings.map((clearing): ClearingId => clearing.id)
  const [target] = inTargetOrder(
    clearings.filter((clearing: ClearingId): boolean => enemyPieceCount(state, clearing, seat) > 0),
    [byMost((clearing: ClearingId): number => enemyPieceCount(state, clearing, seat)), byHighestPriority],
  )
  if (target === undefined) return null
  const enemiesThere = state.players
    .map((player: PlayerState): Seat => player.seat)
    .filter(
      (other: Seat): boolean =>
        isEnemyOfBot(state, seat, other) && piecesOf(state, target, other).length > 0,
    )
  const [defender] = inTargetOrder(enemiesThere, [
    byMost((other: Seat): number => piecesOf(state, target, other).length),
    byMostVictoryPoints(state),
    bySetupPriority(state),
  ])
  if (defender === undefined) return null
  return { defender, travel: { seat, canActIn: (clearing: ClearingId): boolean => clearing === target } }
}

/**
 * Trait Marksman — before the dice, one hit: a defender warrior goes (a
 * point); with no warrior there it becomes an extra hit in the battle.
 */
function marksmanShot(state: GameState, battle: VagabotBattle, ctx: Ctx): { logs: LogEntry[]; extraHits: number } {
  if (!botHasTrait(state, battle.seat, 'marksman')) return { logs: [], extraHits: 0 }
  const warrior = piecesOf(state, battle.clearing, battle.defender).find(
    (piece: Piece): boolean => piece.kind === 'warrior',
  )
  if (warrior === undefined) return { logs: [], extraHits: MARKSMAN_HITS }
  return {
    logs: [
      ...removePieces(
        state,
        { clearing: battle.clearing, pieceIds: [warrior.id], scorer: battle.seat },
        ctx,
      ),
      ...scoreVagabot(
        state,
        { seat: battle.seat, points: MARKSMAN_WARRIOR_VICTORY_POINTS, reason: 'marksman' },
        ctx,
      ),
    ],
    extraHits: 0,
  }
}

/**
 * Open one battle and queue the next one (7.5.4 — repeat while it can pay;
 * trait Adventurer — battle only once per turn).
 */
function battleThere(state: GameState, battle: VagabotBattle, ctx: Ctx): BotTaskResult {
  const shot = marksmanShot(state, battle, ctx)
  if (piecesOf(state, battle.clearing, battle.defender).length === 0) return taskDone(shot.logs)
  const opened = startBotBattle(
    state,
    shot.extraHits > 0 ? { ...battle, attackerExtraHits: shot.extraHits } : battle,
    ctx,
  )
  const next: VagabotTask[] = botHasTrait(state, battle.seat, 'adventurer')
    ? []
    : [{ kind: 'battleAgain', clearing: battle.clearing, defender: battle.defender }]
  return { logs: [...shot.logs, ...opened], followUps: next }
}

/** Rule: Rootbotics 7.5.4 Battle — travel to the target, exhaust one item, battle. */
export function battle(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  const plan = botHasTrait(state, seat, 'berserker')
    ? berserkerBattlePlan(state, seat)
    : leaderBattlePlan(state, seat)
  if (plan === null) return taskDone()
  const travel = travelToAct(state, plan.travel)
  if (travel.clearing === null) return taskDone(travel.logs)
  if (!exhaustItems(vagabotBoardOf(state, seat), FIRST_BATTLE_COST)) return taskDone(travel.logs)
  const opened = battleThere(state, { seat, clearing: travel.clearing, defender: plan.defender }, ctx)
  return { logs: [...travel.logs, ...opened.logs], followUps: opened.followUps }
}

/** Rule: Rootbotics 7.5.4 — pieces of the target remain: two items, battle again. */
export function battleAgain(state: GameState, battle: VagabotBattle, ctx: Ctx): BotTaskResult {
  if (vagabotClearing(state, battle.seat) !== battle.clearing) return taskDone()
  if (piecesOf(state, battle.clearing, battle.defender).length === 0) return taskDone()
  if (!exhaustItems(vagabotBoardOf(state, battle.seat), REPEATED_BATTLE_COST)) return taskDone()
  return battleThere(state, battle, ctx)
}
