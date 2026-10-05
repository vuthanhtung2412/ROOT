import { Deck, defOf } from '#cards/Deck.js'
import {
  boardOf,
  exhaustItem,
  placeItemInSatchelOrTrack,
  satchelCapacity,
} from '#factions/vagabond/items.js'
import { canCraftWithHammers } from '#factions/vagabond/legalActions.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { ClearingId } from '#map/types.js'
import type { ItemType, Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { addVictoryPoints } from '#rules/dominance.js'
import { RuleError } from '#rules/RuleError.js'
import {
  VAGABOND_ALLIED_STEP,
  VAGABOND_RELATIONSHIP_AID_COST,
  VAGABOND_RELATIONSHIP_VP,
  type VagabondBoard,
} from '#state/boards.js'
import type { GameState } from '#state/types.js'

const EXHAUSTIBLE_ITEM_TYPES: readonly ItemType[] = [
  'boot',
  'torch',
  'tea',
  'sword',
  'hammer',
  'crossbow',
  'bag',
  'coin',
]

export function exhaustAnyItem(board: VagabondBoard): boolean {
  for (const type of EXHAUSTIBLE_ITEM_TYPES) {
    if (exhaustItem(board, type) !== null) return true
  }
  return false
}

export function movePawn(
  state: GameState,
  seat: Seat,
  to: ClearingId | `forest:${number}`,
): void {
  const board = boardOf(state, seat)
  for (const clearing of state.clearings) {
    clearing.pieces = clearing.pieces.filter(
      (piece) => !(piece.kind === 'pawn' && piece.owner === seat),
    )
  }
  if (typeof to === 'string') {
    board.forest = Number(to.slice('forest:'.length))
    return
  }
  board.forest = null
  state.clearings[to]!.pieces.push({
    id: `pawn-${seat}`,
    kind: 'pawn',
    owner: seat,
  })
}

export function craftWithHammers(
  state: GameState,
  seat: Seat,
  cardId: string,
  ctx: Ctx,
): LogEntry[] {
  const player = playerOf(state, seat)
  const board = boardOf(state, seat)
  const card = player.hand.find((entry) => entry.id === cardId)
  if (card === undefined) throw new RuleError('CARD_NOT_IN_HAND')
  if (!canCraftWithHammers(state, seat, card)) {
    throw new RuleError('CANNOT_CRAFT', { cardId })
  }
  const def = defOf(card)
  for (let paid = 0; paid < def.cost.length; paid++) {
    if (exhaustItem(board, 'hammer') === null) {
      throw new RuleError('NO_HAMMER')
    }
  }
  const handIndex = player.hand.findIndex((entry) => entry.id === cardId)
  player.hand.splice(handIndex, 1)
  const logs: LogEntry[] = []
  const vp = ctx.hooks.craftVp(state, seat, card)
  if (vp > 0) {
    const scored = addVictoryPoints(state, seat, vp)
    if (scored > 0) {
      logs.push({ t: 'vp', actor: seat, delta: scored, reason: 'craft' })
      ctx.emit({ s: 'vp', actor: seat, delta: scored })
    }
  }
  if (def.type === 'item' && def.item !== undefined) {
    state.itemSupply[def.item]! -= 1
    placeItemInSatchelOrTrack(board, def.item)
    ctx.emit({ s: 'craft.item', actor: seat, cardId, item: def.item })
    Deck.discard(state.deck, card, {
      onDominance: (dominanceCard) => state.dominanceAvailable.push(dominanceCard),
    })
  } else {
    player.playArea.push(card)
    ctx.emit({ s: 'craft.persistent', actor: seat, cardId })
  }
  logs.push({ t: 'action', actor: seat, action: { type: 'vbCraft', cardId } })
  return logs
}

/** Vagabond seat and the seat of the faction its relationship is about. */
export interface VagabondRelation {
  seat: Seat
  target: Seat
}

export function improveRelationship(
  state: GameState,
  relation: VagabondRelation,
  ctx: Ctx,
  logs: LogEntry[],
): void {
  const { seat, target } = relation
  const board = boardOf(state, seat)
  const faction = playerOf(state, target).faction
  const current = board.relationships[faction]
  if (current === 'hostile' || current === undefined) return
  if (current >= VAGABOND_ALLIED_STEP) {
    const scored = addVictoryPoints(state, seat, 2)
    if (scored > 0) {
      logs.push({ t: 'vp', actor: seat, delta: scored, reason: 'allied aid' })
      ctx.emit({ s: 'vp', actor: seat, delta: scored })
    }
    return
  }
  const aids = (state.turnScratch.aidsThisTurn[target] ?? 0) + 1
  state.turnScratch.aidsThisTurn[target] = aids
  const cost = VAGABOND_RELATIONSHIP_AID_COST[current]
  if (cost === undefined || aids < cost) return
  const next = current + 1
  board.relationships[faction] = next
  state.turnScratch.aidsThisTurn[target] = 0
  const vp = VAGABOND_RELATIONSHIP_VP[current] ?? 0
  if (vp > 0) {
    const scored = addVictoryPoints(state, seat, vp)
    if (scored > 0) {
      logs.push({ t: 'vp', actor: seat, delta: scored, reason: 'relationship' })
      ctx.emit({ s: 'vp', actor: seat, delta: scored })
    }
  }
}

export function maybeHostile(
  state: GameState,
  relation: VagabondRelation,
  removedWarrior: boolean,
): void {
  const { seat, target } = relation
  // Rule: 9.2.9.III — remove warrior → Hostile. Infamy only in battle (removePieces).
  if (!removedWarrior) return
  const board = boardOf(state, seat)
  const faction = playerOf(state, target).faction
  if (board.relationships[faction] === 'hostile') return
  board.relationships[faction] = 'hostile'
}

export function enforceCapacity(board: VagabondBoard): void {
  const capacity = satchelCapacity(board)
  while (board.satchel.length + board.damaged.length > capacity) {
    if (board.damaged.length > 0) {
      board.damaged.pop()
      continue
    }
    board.satchel.pop()
  }
}
