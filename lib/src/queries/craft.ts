import { defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import type { CostSuit } from '#cards/types.js'
import type { Suit } from '#map/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import type { GameState } from '#state/types.js'

type CraftSource = { piece: Piece; suit: Suit; clearingId: ClearingId }

const CRAFTABLE_TYPES = new Set(['item', 'persistent', 'partisan'])

/** Rule: Craft 1–4 — unused crafters, suit match, supply item, no dup persistent. */
export function canCraft(state: GameState, seat: Seat, card: Card): boolean {
  const def = defOf(card)
  // Ambush/dominance have empty cost; must not pass as craftable.
  if (!CRAFTABLE_TYPES.has(def.type)) return false

  const sources = craftingSources(state, seat)
  if (!matchCost(def.cost, sources)) return false

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
      if (piece.kind === 'building' && (piece.type === 'workshop' || piece.type === 'roost')) {
        if (!piece.used) out.push({ piece, suit, clearingId })
      }
      if (piece.kind === 'token' && piece.type === 'sympathy') {
        out.push({ piece, suit, clearingId })
      }
    }
  }
  return out
}

function matchCost(cost: CostSuit[], sources: CraftSource[]): boolean {
  if (cost.length === 0) return true
  return matchCostRec(cost, sources, new Set())
}

function matchCostRec(
  cost: CostSuit[],
  sources: CraftSource[],
  used: Set<Piece>,
): boolean {
  if (cost.length === 0) return true
  const [need, ...rest] = cost
  for (const src of sources) {
    if (used.has(src.piece)) continue
    if (!suitMatches(need!, src.suit)) continue
    used.add(src.piece)
    if (matchCostRec(rest, sources, used)) return true
    used.delete(src.piece)
  }
  return false
}

function suitMatches(need: CostSuit, have: Suit): boolean {
  return need === 'wild' || need === have
}
