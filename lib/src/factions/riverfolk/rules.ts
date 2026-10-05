import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { warriorSupplyOf } from '#queries/supply.js'
import { RuleError } from '#rules/RuleError.js'
import {
  RIVERFOLK_FUNDS_PER_DIVIDEND,
  RIVERFOLK_PROTECTIONISM_WARRIORS,
  RIVERFOLK_TRADE_POST_VICTORY_POINTS,
  RIVERFOLK_TRADE_POSTS_PER_SUIT,
  type RiverfolkBoard,
  type RiverfolkFundBox,
} from '#state/riverfolkBoard.js'
import type { GameState, PlayerState } from '#state/types.js'

export const RIVERFOLK_SUITS: readonly Suit[] = ['fox', 'rabbit', 'mouse']

/** Rule: 11.2.5.I Trade Disruption — half of the funds, rounded up. */
const TRADE_DISRUPTION_DIVISOR = 2

export function riverfolkBoardOf(state: GameState, seat: Seat): RiverfolkBoard {
  const board = playerOf(state, seat).board
  if (board.kind !== 'riverfolk') {
    throw new RuleError('NOT_RIVERFOLK', { seat })
  }
  return board
}

export function riverfolkSeat(state: GameState): Seat | null {
  const player = state.players.find(
    (entry: PlayerState): boolean => entry.faction === 'riverfolk',
  )
  return player?.seat ?? null
}

/** Seats owning at least one warrior in the box, in first-seen order. */
export function fundOwners(box: RiverfolkFundBox): Seat[] {
  return [...new Set(box)]
}

export function fundsOwnedBy(box: RiverfolkFundBox, owner: Seat): number {
  return box.filter((fund: Seat): boolean => fund === owner).length
}

function takeFund(board: RiverfolkBoard, owner: Seat): void {
  const fundIndex = board.funds.indexOf(owner)
  if (fundIndex < 0) throw new RuleError('NO_FUND_OF_OWNER', { owner })
  board.funds.splice(fundIndex, 1)
}

/** Rule: 11.5 — a committed fund moves to the Committed box. */
export function commitFund(board: RiverfolkBoard, owner: Seat): void {
  takeFund(board, owner)
  board.committed.push(owner)
}

/** Return one warrior to the supply of the seat that owns it. */
function returnFundToOwner(state: GameState, owner: Seat): void {
  const supply = warriorSupplyOf(playerOf(state, owner).board)
  if (supply !== null) supply.warriors += 1
}

/** Rule: 11.5 — a spent fund returns to its owner's supply. */
export function spendFund(
  state: GameState,
  board: RiverfolkBoard,
  owner: Seat,
): void {
  takeFund(board, owner)
  returnFundToOwner(state, owner)
}

export function hasTradePost(state: GameState, clearing: ClearingId): boolean {
  return (
    state.clearings[clearing]?.pieces.some(
      (piece): boolean => piece.kind === 'token' && piece.type === 'tradePost',
    ) ?? false
  )
}

export function anyTradePostOnMap(state: GameState): boolean {
  return FALL.clearings.some((clearing): boolean =>
    hasTradePost(state, clearing.id),
  )
}

/** Trade Posts track spaces of a suit no longer covered by a trade post. */
export function emptyTradePostSpaces(board: RiverfolkBoard, suit: Suit): number {
  return RIVERFOLK_TRADE_POSTS_PER_SUIT - board.tradePosts[suit]
}

/** Rule: 11.5.6.III — points on the space the next trade post of a suit uncovers. */
export function nextTradePostVictoryPoints(
  board: RiverfolkBoard,
  suit: Suit,
): number {
  return (
    RIVERFOLK_TRADE_POST_VICTORY_POINTS[emptyTradePostSpaces(board, suit)] ?? 0
  )
}

/** Rule: 11.4.1 Protectionism — an empty Payments box gets two warriors. */
export function applyProtectionism(board: RiverfolkBoard, seat: Seat): void {
  if (board.payments.length > 0) return
  const placed = Math.min(
    RIVERFOLK_PROTECTIONISM_WARRIORS,
    board.supply.warriors,
  )
  board.supply.warriors -= placed
  for (let warrior = 0; warrior < placed; warrior++) {
    board.payments.push(seat)
  }
}

/** Rule: 11.4.2 Score Dividends — one point per two funds with a trade post out. */
export function dividendVictoryPoints(
  state: GameState,
  board: RiverfolkBoard,
): number {
  if (!anyTradePostOnMap(state)) return 0
  return Math.floor(board.funds.length / RIVERFOLK_FUNDS_PER_DIVIDEND)
}

/** Rule: 11.4.3 Gather Funds — every warrior on the board moves to Funds. */
export function gatherFunds(board: RiverfolkBoard): void {
  board.funds.push(...board.payments, ...board.committed)
  board.payments = []
  board.committed = []
  for (const suit of RIVERFOLK_SUITS) {
    board.funds.push(...board.craftCommitted[suit])
    board.craftCommitted[suit] = []
  }
}

/**
 * Rule: 11.2.5.I Trade Disruption — a removed trade post leaves the game and
 * takes half of the funds (rounded up) with it, back to their owners.
 */
export function applyTradeDisruption(state: GameState, seat: Seat): void {
  const board = riverfolkBoardOf(state, seat)
  const lostCount = Math.ceil(board.funds.length / TRADE_DISRUPTION_DIVISOR)
  const lostFunds = board.funds.splice(0, lostCount)
  for (const owner of lostFunds) {
    returnFundToOwner(state, owner)
  }
}
