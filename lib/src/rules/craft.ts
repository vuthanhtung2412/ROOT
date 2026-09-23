import { defOf } from '#cards/Deck.js'
import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canCraft } from '#queries/craft.js'
import { playerOf } from '#queries/seat.js'
import type { GameState } from '#state/types.js'
import { RuleError } from '#rules/RuleError.js'

type CraftSource = { piece: Piece; clearingId: ClearingId }

function craftingSources(state: GameState, seat: Seat): CraftSource[] {
  const out: CraftSource[] = []
  for (let clearingId = 0; clearingId < state.clearings.length; clearingId++) {
    for (const piece of state.clearings[clearingId]!.pieces) {
      if (piece.owner !== seat) continue
      if (piece.kind === 'building' && (piece.type === 'workshop' || piece.type === 'roost')) {
        if (!piece.used) out.push({ piece, clearingId })
      }
      if (piece.kind === 'token' && piece.type === 'sympathy') {
        out.push({ piece, clearingId })
      }
    }
  }
  return out
}

function assignSources(cost: import('#cards/types.js').CostSuit[], sources: CraftSource[]): CraftSource[] | null {
  const used = new Set<Piece>()
  const picked: CraftSource[] = []

  function rec(need: typeof cost): boolean {
    if (need.length === 0) return true
    const [suit, ...rest] = need
    for (const src of sources) {
      if (used.has(src.piece)) continue
      const clearingSuit = FALL.clearings[src.clearingId]!.suit
      if (suit !== 'wild' && suit !== clearingSuit) continue
      used.add(src.piece)
      picked.push(src)
      if (rec(rest)) return true
      picked.pop()
      used.delete(src.piece)
    }
    return false
  }

  return rec(cost) ? picked : null
}

function removeFromHand(player: ReturnType<typeof playerOf>, cardId: string): Card {
  const idx = player.hand.findIndex((c) => c.id === cardId)
  if (idx < 0) throw new RuleError('CARD_NOT_IN_HAND', { cardId })
  return player.hand.splice(idx, 1)[0]!
}

/** Rule: Craft 1–4 — craft card via workshops; score VP before craft.item signal. */
export function craftCard(
  state: GameState,
  seat: Seat,
  cardId: string,
  ctx: Ctx,
): LogEntry[] {
  const player = playerOf(state, seat)
  const card = player.hand.find((c) => c.id === cardId)
  if (!card) throw new RuleError('CARD_NOT_IN_HAND', { cardId })

  const def = defOf(card)
  if (def.type !== 'item' && def.type !== 'persistent' && def.type !== 'partisan') {
    throw new RuleError('NOT_CRAFTABLE', { cardId, type: def.type })
  }
  if (!canCraft(state, seat, card)) throw new RuleError('CANNOT_CRAFT', { cardId })

  const sources = assignSources(def.cost, craftingSources(state, seat))
  if (!sources) throw new RuleError('CANNOT_CRAFT', { cardId, reason: 'no sources' })

  for (const src of sources) {
    if (
      src.piece.kind === 'building' &&
      (src.piece.type === 'workshop' || src.piece.type === 'roost')
    ) {
      src.piece.used = true
    }
  }

  const logs: LogEntry[] = []
  const vp = ctx.hooks.craftVp(state, seat, card)
  if (vp > 0) {
    player.vp += vp
    logs.push({ t: 'vp', actor: seat, delta: vp, reason: 'craft' })
    ctx.emit({ s: 'vp', actor: seat, delta: vp })
  }

  removeFromHand(player, cardId)

  if (def.type === 'item') {
    if (!def.item) throw new RuleError('INVALID_ITEM_CARD', { cardId })
    if ((state.itemSupply[def.item] ?? 0) < 1) {
      throw new RuleError('ITEM_SUPPLY_EMPTY', { item: def.item })
    }
    state.itemSupply[def.item]! -= 1
    player.craftedItems.push({ type: def.item, exhausted: false })
    ctx.emit({ s: 'craft.item', actor: seat, cardId, item: def.item })
    Deck.discard(state.deck, card, {
      onDominance: (c) => state.dominanceAvailable.push(c),
    })
    logs.push({ t: 'action', actor: seat, action: { type: 'craft', cardId } })
    return logs
  }

  // persistent | partisan
  player.playArea.push(card)
  ctx.emit({ s: 'craft.persistent', actor: seat, cardId })
  logs.push({ t: 'action', actor: seat, action: { type: 'craft', cardId } })
  return logs
}
