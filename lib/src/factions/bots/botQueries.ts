import { openBattle } from '#events/battle.js'
import type { Tiebreaker } from '#factions/bots/priority.js'
import { inTargetOrder } from '#factions/bots/priority.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canBattle } from '#queries/battle.js'
import { canMove } from '#queries/move.js'
import { piecesIn, warriors } from '#queries/pieces.js'
import { ruler } from '#queries/ruler.js'
import { moveWarriors, type WarriorMovement } from '#rules/move.js'
import { placeUpTo } from '#rules/place.js'
import type { GameState } from '#state/types.js'

export type BotBattle = {
  seat: Seat
  clearing: ClearingId
}

export type BotPlacement = {
  seat: Seat
  clearing: ClearingId
  count: number
}

/** Rule: Rootbotics 2.6 — every other player is an enemy of a bot. */
export function enemyPieceCount(
  state: GameState,
  clearing: ClearingId,
  seat: Seat,
): number {
  return piecesIn(state, clearing).filter(
    (piece: Piece): boolean => piece.owner !== seat,
  ).length
}

export function pieceCountOf(
  state: GameState,
  clearing: ClearingId,
  seat: Seat,
): number {
  return piecesIn(state, clearing).filter(
    (piece: Piece): boolean => piece.owner === seat,
  ).length
}

export function buildingCountOf(
  state: GameState,
  clearing: ClearingId,
  seat: Seat,
): number {
  return piecesIn(state, clearing).filter(
    (piece: Piece): boolean => piece.owner === seat && piece.kind === 'building',
  ).length
}

export function ruledClearings(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): ClearingId[] {
  return FALL.clearings
    .map((clearing): ClearingId => clearing.id)
    .filter(
      (clearing: ClearingId): boolean =>
        ruler(state, clearing, ctx.hooks) === seat,
    )
}

/** Players a bot may battle in a clearing, in its target order (2.2, 2.3). */
export function defendersInOrder(
  state: GameState,
  battle: BotBattle,
  tiebreakers: readonly Tiebreaker<Seat>[],
): Seat[] {
  const candidates: Seat[] = state.players
    .map((player): Seat => player.seat)
    .filter((defender: Seat): boolean =>
      canBattle(state, battle.seat, battle.clearing, defender),
    )
  return inTargetOrder(candidates, tiebreakers)
}

/** Open a battle for a bot and log it. */
export function startBotBattle(
  state: GameState,
  battle: BotBattle & { defender: Seat; attackerExtraHits?: number },
  ctx: Ctx,
): LogEntry[] {
  const extraHits =
    battle.attackerExtraHits === undefined
      ? {}
      : { attackerExtraHits: battle.attackerExtraHits }
  const logs: LogEntry[] = [
    {
      t: 'action',
      actor: battle.seat,
      action: { type: 'botBattle', clearing: battle.clearing, defender: battle.defender },
    },
  ]
  logs.push(
    ...openBattle(
      state,
      {
        clearing: battle.clearing,
        attacker: battle.seat,
        defender: battle.defender,
        ...extraHits,
      },
      ctx,
    ),
  )
  return logs
}

/** Place warriors for a bot (capped by supply) and log how many. */
export function placeBotWarriors(
  state: GameState,
  placement: BotPlacement,
): LogEntry[] {
  const placed = placeUpTo(state, {
    seat: placement.seat,
    clearing: placement.clearing,
    spec: { kind: 'warrior' },
    count: placement.count,
  })
  if (placed === 0) return []
  return [
    {
      t: 'action',
      actor: placement.seat,
      action: { type: 'botRecruit', clearing: placement.clearing, count: placed },
    },
  ]
}

export function canBotMove(
  state: GameState,
  movement: WarriorMovement,
  ctx: Ctx,
): boolean {
  return (
    movement.count > 0 &&
    warriors(state, movement.from, movement.seat) >= movement.count &&
    canMove(state, { seat: movement.seat, from: movement.from, to: movement.to }, ctx.hooks)
  )
}

/** Move warriors for a bot and log it. */
export function moveBotWarriors(
  state: GameState,
  movement: WarriorMovement,
  ctx: Ctx,
): LogEntry[] {
  return [
    ...moveWarriors(state, movement, ctx),
    {
      t: 'action',
      actor: movement.seat,
      action: {
        type: 'botMove',
        from: movement.from,
        to: movement.to,
        count: movement.count,
      },
    },
  ]
}
