import { defOf } from '#cards/Deck.js'
import type { Card, CostSuit } from '#cards/types.js'
import {
  emptyTradePostSpaces,
  RIVERFOLK_SUITS,
} from '#factions/riverfolk/rules.js'
import type { Suit } from '#map/types.js'
import { isCraftableCard } from '#queries/craft.js'
import { RuleError } from '#rules/RuleError.js'
import type { RiverfolkBoard } from '#state/riverfolkBoard.js'

/** Empty Trade Posts spaces of a suit not yet holding a committed fund. */
function freeCraftSpaces(board: RiverfolkBoard, suit: Suit): number {
  return emptyTradePostSpaces(board, suit) - board.craftCommitted[suit].length
}

/**
 * Rule: 11.5.3 Craft — one empty Trade Posts space per cost suit.
 * Returns the track suit used for each cost entry, or null when unpayable.
 * A wild cost takes the suit with the most free spaces.
 */
export function assignCraftSpaces(
  board: RiverfolkBoard,
  cost: readonly CostSuit[],
): Suit[] | null {
  if (board.funds.length < cost.length) return null
  const free: Record<Suit, number> = {
    fox: freeCraftSpaces(board, 'fox'),
    rabbit: freeCraftSpaces(board, 'rabbit'),
    mouse: freeCraftSpaces(board, 'mouse'),
  }
  const assigned: Suit[] = []
  const wildCount = cost.filter((need: CostSuit): boolean => need === 'wild').length
  for (const need of cost) {
    if (need === 'wild') continue
    if (free[need] < 1) return null
    free[need] -= 1
    assigned.push(need)
  }
  for (let wild = 0; wild < wildCount; wild++) {
    const roomiest = [...RIVERFOLK_SUITS].sort(
      (left: Suit, right: Suit): number => free[right] - free[left],
    )[0]!
    if (free[roomiest] < 1) return null
    free[roomiest] -= 1
    assigned.push(roomiest)
  }
  return assigned
}

/** Rule: 11.5.3 — the Riverfolk can pay a card's crafting cost with funds. */
export function canPayCraftCost(board: RiverfolkBoard, card: Card): boolean {
  return (
    isCraftableCard(card) && assignCraftSpaces(board, defOf(card).cost) !== null
  )
}

/**
 * Rule: 11.5.3 — move one fund per cost suit onto the Trade Posts tracks
 * (funds are taken in box order).
 */
export function payCraftCost(board: RiverfolkBoard, card: Card): void {
  const spaces = assignCraftSpaces(board, defOf(card).cost)
  if (spaces === null) throw new RuleError('CANNOT_CRAFT', { cardId: card.id })
  for (const suit of spaces) {
    const fund = board.funds.shift()
    if (fund === undefined) throw new RuleError('NO_FUNDS')
    board.craftCommitted[suit].push(fund)
  }
}
