import { defOf } from '#cards/Deck.js'
import { Deck } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { isCraftingBuilding, type Seat } from '#pieces/types.js'
import { assignCraftSources, canCraft } from '#queries/craft.js'
import { playerOf } from '#queries/seat.js'
import type { GameState } from '#state/types.js'
import { RuleError } from '#rules/RuleError.js'

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

  const sources = assignCraftSources(state, seat, def.cost)
  if (!sources) throw new RuleError('CANNOT_CRAFT', { cardId, reason: 'no sources' })

  for (const src of sources) {
    if (isCraftingBuilding(src.piece)) {
      src.piece.used = true
    }
    if (src.piece.kind === 'token' && src.piece.type === 'sympathy') {
      state.turnScratch.sympathyCraftedIds.push(src.piece.id)
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

/** Rule: Craft — each crafting piece activates once per turn; reset at endTurn. */
export function resetCraftingBuildingUsed(state: GameState, seat: Seat): void {
  for (const clearing of state.clearings) {
    for (const piece of clearing.pieces) {
      if (piece.owner === seat && isCraftingBuilding(piece)) {
        piece.used = false
      }
    }
  }
}
