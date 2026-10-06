import type { ActionOption } from '#actions/options.js'
import type { ActionSpec } from '#actions/types.js'
import { canPayCraftCost } from '#factions/riverfolk/craft.js'
import {
  fundOwners,
  fundsOwnedBy,
  hasTradePost,
  riverfolkBoardOf,
} from '#factions/riverfolk/rules.js'
import { handLimitLegalAction } from '#factions/sharedTurn.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { legalBattleTargets } from '#queries/battle.js'
import { craftBenefitAvailable } from '#queries/craft.js'
import { canMove } from '#queries/move.js'
import { warriors } from '#queries/pieces.js'
import { canPlace } from '#queries/place.js'
import { ruler } from '#queries/ruler.js'
import { playerOf } from '#queries/seat.js'
import {
  RIVERFOLK_SERVICE_COSTS,
  RIVERFOLK_TRADE_POST_FUND_COST,
  type RiverfolkBoard,
} from '#state/riverfolkBoard.js'
import type { GameState } from '#state/types.js'

function pushOptions(
  specs: ActionSpec[],
  type: string,
  actor: Seat,
  options: ActionOption[],
): void {
  if (options.length === 0) return
  specs.push({ type, actor, params: { options } })
}

/** Every option once per fund the Riverfolk could commit or spend for it. */
function perFundOwner(
  options: readonly ActionOption[],
  owners: readonly Seat[],
): ActionOption[] {
  return options.flatMap((option: ActionOption): ActionOption[] =>
    owners.map((fundOwner: Seat): ActionOption => ({ ...option, fundOwner })),
  )
}

function moveOptions(state: GameState, seat: Seat, ctx: Ctx): ActionOption[] {
  const options: ActionOption[] = []
  for (let from = 0; from < state.clearings.length; from++) {
    const available = warriors(state, from, seat)
    for (let to = 0; to < state.clearings.length; to++) {
      if (!canMove(state, { seat, from, to }, ctx.hooks)) continue
      for (let count = 1; count <= available; count++) {
        options.push({ from, to, count })
      }
    }
  }
  return options
}

/** Rule: 11.5.5 Recruit — any clearing with a river. */
function recruitOptions(
  state: GameState,
  seat: Seat,
  board: RiverfolkBoard,
): ActionOption[] {
  if (board.supply.warriors < 1) return []
  return FALL.riverClearings()
    .filter((clearing: ClearingId): boolean => canPlace(state, seat, clearing))
    .map((clearing: ClearingId): ActionOption => ({ clearing }))
}

/**
 * Rule: 11.5.6 — a clearing without a trade post, ruled by a player whose
 * warriors make up two of the funds, with a matching trade post left.
 */
function tradePostOptions(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): ActionOption[] {
  const board = riverfolkBoardOf(state, seat)
  const options: ActionOption[] = []
  for (const clearing of FALL.clearings) {
    if (hasTradePost(state, clearing.id)) continue
    if (board.tradePosts[clearing.suit] < 1) continue
    if (!canPlace(state, seat, clearing.id)) continue
    const clearingRuler = ruler(state, clearing.id, ctx.hooks)
    if (clearingRuler === null) continue
    if (
      fundsOwnedBy(board.funds, clearingRuler) < RIVERFOLK_TRADE_POST_FUND_COST
    ) {
      continue
    }
    options.push({ clearing: clearing.id })
  }
  return options
}

/** Rule: 11.5.3 — craft for the benefit, or Export for a Payments warrior. */
function craftOptions(state: GameState, seat: Seat): ActionOption[] {
  const board = riverfolkBoardOf(state, seat)
  const options: ActionOption[] = []
  for (const card of playerOf(state, seat).hand) {
    if (!canPayCraftCost(board, card)) continue
    if (craftBenefitAvailable(state, card)) {
      options.push({ cardId: card.id, exportCard: false })
    }
    options.push({ cardId: card.id, exportCard: true })
  }
  return options
}

function daylightLegalActions(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): ActionSpec[] {
  const board = riverfolkBoardOf(state, seat)
  const owners = fundOwners(board.funds)
  const specs: ActionSpec[] = []
  pushOptions(
    specs,
    'riverfolkMove',
    seat,
    perFundOwner(moveOptions(state, seat, ctx), owners),
  )
  pushOptions(
    specs,
    'riverfolkBattle',
    seat,
    perFundOwner(
      legalBattleTargets(state, seat).map(
        (target): ActionOption => ({ ...target }),
      ),
      owners,
    ),
  )
  pushOptions(specs, 'riverfolkCraft', seat, craftOptions(state, seat))
  pushOptions(specs, 'riverfolkDraw', seat, perFundOwner([{}], owners))
  pushOptions(
    specs,
    'riverfolkRecruit',
    seat,
    perFundOwner(recruitOptions(state, seat, board), owners),
  )
  pushOptions(
    specs,
    'establishTradePost',
    seat,
    tradePostOptions(state, seat, ctx),
  )
  specs.push({ type: 'endPhase', actor: seat })
  return specs
}

/**
 * Rule: 11.6.2 Set Costs — each marker may move to any space of its track.
 * One option per combination, so a single action sets all three services.
 */
function serviceCostOptions(): ActionOption[] {
  const options: ActionOption[] = []
  for (const handCard of RIVERFOLK_SERVICE_COSTS) {
    for (const riverboats of RIVERFOLK_SERVICE_COSTS) {
      for (const mercenaries of RIVERFOLK_SERVICE_COSTS) {
        options.push({ handCard, riverboats, mercenaries })
      }
    }
  }
  return options
}

export function riverfolkLegalActions(state: GameState, ctx: Ctx): ActionSpec[] {
  const seat = state.currentSeat
  const specs: ActionSpec[] = [...ctx.grantedActions()]

  if (state.phase === 'daylight') {
    specs.push(...daylightLegalActions(state, seat, ctx))
    return specs
  }
  if (state.phase === 'evening' && state.step === 'discard') {
    specs.push(handLimitLegalAction(state, seat))
    return specs
  }
  if (state.phase === 'evening' && state.step === 'costs') {
    specs.push({
      type: 'setServiceCosts',
      actor: seat,
      params: {
        options: serviceCostOptions(),
        serviceCosts: [{ ...riverfolkBoardOf(state, seat).serviceCosts }],
      },
    })
  }
  specs.push({ type: 'endPhase', actor: seat })
  return specs
}
