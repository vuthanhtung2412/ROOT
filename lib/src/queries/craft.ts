import { defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import type { CostSuit } from '#cards/types.js'
import { gardenCraftsInSuit } from '#factions/lizard/rules.js'
import type { Suit } from '#map/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import { isCraftingBuilding, type Piece, type Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'

export type CraftSource = {
  piece: Piece
  suit: Suit
  clearingId: ClearingId
}

const CRAFTABLE_TYPES = new Set(['item', 'persistent', 'partisan'])

/** Rule: Craft 1–4 — unused crafters, suit match, supply item, no dup persistent. */
export function canCraft(state: GameState, seat: Seat, card: Card): boolean {
  if (!isCraftableCard(card)) return false

  if (assignCraftSources(state, seat, defOf(card).cost) === null) return false

  return craftBenefitAvailable(state, card)
}

/** Ambush/dominance have empty cost; must not pass as craftable. */
export function isCraftableCard(card: Card): boolean {
  return CRAFTABLE_TYPES.has(defOf(card).type)
}

/** Rule: Craft 4.1.2 / 4.1.4 — item still in supply; no duplicate persistent. */
export function craftBenefitAvailable(state: GameState, card: Card): boolean {
  const def = defOf(card)

  if (def.type === 'item') {
    if (!def.item) return false
    if ((state.itemSupply[def.item] ?? 0) < 1) return false
  }

  if (def.type === 'persistent') {
    for (const player of state.players) {
      if (player.playArea.some((c) => c.defId === def.defId)) return false
    }
  }

  return true
}

function craftingSources(state: GameState, seat: Seat): CraftSource[] {
  const out: CraftSource[] = []
  for (let clearingId = 0; clearingId < state.clearings.length; clearingId++) {
    const suit = FALL.clearings[clearingId]!.suit
    for (const piece of state.clearings[clearingId]!.pieces) {
      if (piece.owner !== seat) continue
      if (isCraftingBuilding(piece) && !piece.used) {
        // Rule: 10.2.1 — gardens craft only in the Outcast suit.
        if (piece.type === 'garden' && !gardenCraftsInSuit(state, seat, suit)) {
          continue
        }
        out.push({ piece, suit, clearingId })
      }
      if (piece.kind === 'token' && piece.type === 'sympathy') {
        if (state.turnScratch.sympathyCraftedIds.includes(piece.id)) continue
        out.push({ piece, suit, clearingId })
      }
    }
  }
  return out
}

function assignCostSources(
  cost: CostSuit[],
  sources: CraftSource[],
): CraftSource[] | null {
  const used = new Set<Piece>()
  const assigned: CraftSource[] = []

  function visit(remainingCost: CostSuit[]): boolean {
    if (remainingCost.length === 0) return true
    const [need, ...rest] = remainingCost
    for (const source of sources) {
      if (used.has(source.piece)) continue
      if (!suitMatches(need!, source.suit)) continue
      used.add(source.piece)
      assigned.push(source)
      if (visit(rest)) return true
      assigned.pop()
      used.delete(source.piece)
    }
    return false
  }

  return visit(cost) ? assigned : null
}

export function assignCraftSources(
  state: GameState,
  seat: Seat,
  cost: CostSuit[],
): CraftSource[] | null {
  return assignCostSources(cost, craftingSources(state, seat))
}

function suitMatches(need: CostSuit, have: Suit): boolean {
  return need === 'wild' || need === have
}

/** Suit of every crafting piece the seat can still activate this turn. */
export function unusedCraftingSuits(state: GameState, seat: Seat): Suit[] {
  return craftingSources(state, seat).map(
    (source: CraftSource): Suit => source.suit,
  )
}
