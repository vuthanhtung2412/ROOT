import { Deck, defOf } from '#cards/Deck.js'
import type { Card, CardSuit } from '#cards/types.js'
import { shuffleWithRng } from '#game/setup.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { gainItem } from '#factions/bots/vagabot/items.js'
import type {
  AutomatedAllianceBoard,
  ElectricEyrieBoard,
  MechanicalMarquiseBoard,
  VagabotBoard,
} from '#state/botBoards.js'
import type { FactionBoard } from '#state/boards.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 1.1.2 — a bot scores one point per crafted item. */
const BOT_CRAFT_VICTORY_POINTS = 1
const ORDER_CARDS_DRAWN = 1

export type BotBoard =
  | MechanicalMarquiseBoard
  | ElectricEyrieBoard
  | AutomatedAllianceBoard
  | VagabotBoard

export function isBotBoard(board: FactionBoard): board is BotBoard {
  return (
    board.kind === 'mechanicalMarquise' ||
    board.kind === 'electricEyrie' ||
    board.kind === 'automatedAlliance' ||
    board.kind === 'vagabot'
  )
}

export function botBoardOf(state: GameState, seat: Seat): BotBoard {
  const board = playerOf(state, seat).board
  if (isBotBoard(board)) return board
  throw new Error(`seat ${seat} is not a bot`)
}

export function orderSuitOf(board: BotBoard): CardSuit | null {
  return board.orderCard === null ? null : defOf(board.orderCard).suit
}

/** Rule: Rootbotics 2.7 — "ordered" clearings match the order card; a bird matches all. */
export function orderedClearings(suit: CardSuit): ClearingId[] {
  return FALL.clearings
    .filter((clearing): boolean => suit === 'bird' || clearing.suit === suit)
    .map((clearing): ClearingId => clearing.id)
}

/** Rule: Rootbotics 2.7 / 4.4.1 / 5.4.1 — draw and reveal an order card. */
export function revealOrderCard(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): LogEntry[] {
  const board = botBoardOf(state, seat)
  const [drawn] = Deck.draw(state.deck, ORDER_CARDS_DRAWN, {
    shuffle: (cards: Card[]): Card[] => shuffleWithRng(cards, ctx.rng),
  })
  board.orderCard = drawn ?? null
  if (drawn === undefined) return []
  return [
    { t: 'action', actor: seat, action: { type: 'revealOrder', cardId: drawn.id } },
  ]
}

/**
 * Rule: Rootbotics 4.4.2 / 5.4.2 + 1.1 — if the order card shows an item
 * still in the supply, craft it: no crafting pieces, one point, never a
 * persistent effect. The card itself stays the order card.
 */
export function craftOrderCard(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): LogEntry[] {
  const board = botBoardOf(state, seat)
  const order = board.orderCard
  if (order === null) return []
  const definition = defOf(order)
  if (definition.type !== 'item' || definition.item === undefined) return []
  const item = definition.item
  if ((state.itemSupply[item] ?? 0) < 1) return []
  state.itemSupply[item] -= 1
  // Rule: Rootbotics 7.2.3 — the Vagabot's items go face up in its Satchel.
  if (board.kind === 'vagabot') {
    gainItem(board, item)
  } else {
    playerOf(state, seat).craftedItems.push({ type: item, exhausted: false })
  }
  ctx.emit({ s: 'craft.item', actor: seat, cardId: order.id, item })
  const logs: LogEntry[] = [
    { t: 'action', actor: seat, action: { type: 'botCraft', cardId: order.id } },
  ]
  const scored = addVictoryPoints(state, seat, BOT_CRAFT_VICTORY_POINTS)
  if (scored > 0) {
    logs.push({ t: 'vp', actor: seat, delta: scored, reason: 'craft' })
    ctx.emit({ s: 'vp', actor: seat, delta: scored })
  }
  return logs
}

/** Discard the order card (Mechanical Marquise Evening 4.6.2, Expand 4.5.5). */
export function discardOrderCard(state: GameState, seat: Seat): void {
  const board = botBoardOf(state, seat)
  if (board.orderCard === null) return
  Deck.discard(state.deck, board.orderCard, {
    onDominance: (dominanceCard: Card): void => {
      state.dominanceAvailable.push(dominanceCard)
    },
  })
  board.orderCard = null
}
