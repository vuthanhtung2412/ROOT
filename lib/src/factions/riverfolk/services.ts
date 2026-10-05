import type { ActionOption } from '#actions/options.js'
import type { Card } from '#cards/types.js'
import {
  hasTradePost,
  riverfolkBoardOf,
  riverfolkSeat,
} from '#factions/riverfolk/rules.js'
import {
  allUndamagedItems,
  exhaustItem,
} from '#factions/vagabond/items.js'
import { FALL } from '#map/fall.js'
import type { ItemType, Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { warriorSupplyOf } from '#queries/supply.js'
import { RuleError } from '#rules/RuleError.js'
import type { VagabondBoard, VagabondItem } from '#state/boards.js'
import {
  RIVERFOLK_BASE_SERVICES_PER_TURN,
  RIVERFOLK_SERVICES,
  type RiverfolkService,
} from '#state/riverfolkBoard.js'
import type { GameState } from '#state/types.js'

/**
 * Rule: 11.2.6.III Vagabond Funds — items exhausted to pay, cheapest to lose
 * first (items on tracks keep their face-up bonus longest).
 */
const VAGABOND_PAYMENT_ORDER: readonly ItemType[] = [
  'torch',
  'hammer',
  'crossbow',
  'boot',
  'sword',
  'coin',
  'bag',
  'tea',
]

export type ServicePurchase = {
  service: RiverfolkService
  /** Hand Card only — the card taken from the Riverfolk's hand. */
  cardId?: string
}

function readyItems(board: VagabondBoard): VagabondItem[] {
  return allUndamagedItems(board).filter(
    (item: VagabondItem): boolean => !item.exhausted,
  )
}

/** Warriors (or Vagabond items) the buyer can still pay with. */
function paymentCapacity(state: GameState, buyer: Seat): number {
  const board = playerOf(state, buyer).board
  if (board.kind === 'vagabond') return readyItems(board).length
  return warriorSupplyOf(board)?.warriors ?? 0
}

/** Rule: 11.2.6.II — one service plus one per trade post clearing with buyer pieces. */
export function servicesPerTurn(state: GameState, buyer: Seat): number {
  const tradePostClearings = FALL.clearings.filter(
    (clearing): boolean =>
      hasTradePost(state, clearing.id) &&
      state.clearings[clearing.id]!.pieces.some(
        (piece): boolean => piece.owner === buyer,
      ),
  ).length
  return RIVERFOLK_BASE_SERVICES_PER_TURN + tradePostClearings
}

function isServiceOnOffer(
  state: GameState,
  buyer: Seat,
  service: RiverfolkService,
): boolean {
  if (service === 'riverboats') return !state.turnScratch.riverboats
  if (service === 'mercenaries') {
    // Rule: 11.2.7.IIIb — the Vagabond cannot buy Riverfolk mercenaries.
    if (playerOf(state, buyer).faction === 'vagabond') return false
    return !state.turnScratch.mercenaries
  }
  return true
}

/** Services the buyer can afford right now, as resolveEvent payloads. */
export function purchasableServices(
  state: GameState,
  buyer: Seat,
): ActionOption[] {
  const seller = riverfolkSeat(state)
  if (seller === null || seller === buyer) return []
  const board = riverfolkBoardOf(state, seller)
  const capacity = paymentCapacity(state, buyer)
  const options: ActionOption[] = []
  for (const service of RIVERFOLK_SERVICES) {
    if (board.serviceCosts[service] > capacity) continue
    if (!isServiceOnOffer(state, buyer, service)) continue
    if (service !== 'handCard') {
      options.push({ service })
      continue
    }
    for (const card of playerOf(state, seller).hand) {
      options.push({ service, cardId: card.id })
    }
  }
  return options
}

/**
 * Rule: 11.2.6.I Cost — buyer warriors go to Payments.
 * Rule: 11.2.6.III — the Vagabond exhausts items; Riverfolk warriors go instead.
 */
function payForService(state: GameState, buyer: Seat, cost: number): void {
  const seller = riverfolkSeat(state)
  if (seller === null) throw new RuleError('NO_RIVERFOLK')
  const sellerBoard = riverfolkBoardOf(state, seller)
  const buyerBoard = playerOf(state, buyer).board
  if (buyerBoard.kind === 'vagabond') {
    for (let paid = 0; paid < cost; paid++) {
      const itemType = VAGABOND_PAYMENT_ORDER.find(
        (type: ItemType): boolean =>
          readyItems(buyerBoard).some(
            (item: VagabondItem): boolean => item.type === type,
          ),
      )
      if (itemType === undefined) throw new RuleError('CANNOT_PAY_SERVICE')
      exhaustItem(buyerBoard, itemType)
      if (sellerBoard.supply.warriors > 0) {
        sellerBoard.supply.warriors -= 1
        sellerBoard.payments.push(seller)
      }
    }
    return
  }
  const supply = warriorSupplyOf(buyerBoard)
  if (supply === null || supply.warriors < cost) {
    throw new RuleError('CANNOT_PAY_SERVICE', { cost })
  }
  supply.warriors -= cost
  for (let paid = 0; paid < cost; paid++) {
    sellerBoard.payments.push(buyer)
  }
}

/** Rule: 11.2.7.I Hand Card — the buyer takes a card from the Riverfolk's hand. */
function takeHandCard(state: GameState, buyer: Seat, cardId: string): void {
  const seller = riverfolkSeat(state)
  if (seller === null) throw new RuleError('NO_RIVERFOLK')
  const sellerHand = playerOf(state, seller).hand
  const cardIndex = sellerHand.findIndex(
    (card: Card): boolean => card.id === cardId,
  )
  if (cardIndex < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId })
  const card = sellerHand.splice(cardIndex, 1)[0]!
  playerOf(state, buyer).hand.push(card)
}

/** Rule: 11.2.6–11.2.7 — pay the listed cost, then gain the service. */
export function buyService(
  state: GameState,
  buyer: Seat,
  purchase: ServicePurchase,
): void {
  const seller = riverfolkSeat(state)
  if (seller === null) throw new RuleError('NO_RIVERFOLK')
  const cost = riverfolkBoardOf(state, seller).serviceCosts[purchase.service]
  payForService(state, buyer, cost)
  if (purchase.service === 'riverboats') {
    state.turnScratch.riverboats = true
    return
  }
  if (purchase.service === 'mercenaries') {
    state.turnScratch.mercenaries = true
    return
  }
  if (purchase.cardId === undefined) throw new RuleError('MISSING_HAND_CARD')
  takeHandCard(state, buyer, purchase.cardId)
}
