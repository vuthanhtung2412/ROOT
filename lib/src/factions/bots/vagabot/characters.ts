import { Deck, defOf } from '#cards/Deck.js'
import type { Card } from '#cards/types.js'
import { taskDone, type BotTaskResult } from '#factions/bots/BotFaction.js'
import { isBotSeat } from '#factions/bots/botFactions.js'
import { vagabotBoardOf } from '#factions/bots/botBoards.js'
import { isEnemyOfBot, pieceCountOf } from '#factions/bots/botQueries.js'
import { byMost, byMostVictoryPoints, bySetupPriority, inTargetOrder } from '#factions/bots/priority.js'
import { scoreVagabot } from '#factions/bots/vagabot/actions.js'
import { damagedItems, exhaustItems, gainItem } from '#factions/bots/vagabot/items.js'
import { slipToRandomForest, vagabotClearing } from '#factions/bots/vagabot/pawn.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { ItemType, Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { randomIndex } from '#rules/Rng.js'
import type { GameState, PlayerState } from '#state/types.js'

/** Rule: Rootbotics 7.5.6 — one item for the special action. */
const SPECIAL_COST = 1
/** Rule: Rootbotics 1.1.2 — a bot scores one point per crafted item. */
const DAY_LABOR_VICTORY_POINTS = 1
/** Rule: Rootbotics 7.7.3 Hideout — three or more damaged items. */
const HIDEOUT_DAMAGED_ITEMS = 3

/**
 * Thief (Steal): an enemy in the clearing holding cards — most points, then
 * most pieces there. The card leaves the human's hand for the discard pile
 * (bots keep no hand, 2.8.1); a bot holds nothing to steal.
 */
function steal(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const clearing = vagabotClearing(state, seat)
  if (clearing === null) return []
  const targets = state.players
    .filter(
      (other: PlayerState): boolean =>
        isEnemyOfBot(state, seat, other.seat) &&
        !isBotSeat(state, other.seat) &&
        other.hand.length > 0 &&
        pieceCountOf(state, clearing, other.seat) > 0,
    )
    .map((other: PlayerState): Seat => other.seat)
  const [target] = inTargetOrder(targets, [
    byMostVictoryPoints(state),
    byMost((candidate: Seat): number => pieceCountOf(state, clearing, candidate)),
    bySetupPriority(state),
  ])
  if (target === undefined || !exhaustItems(vagabotBoardOf(state, seat), SPECIAL_COST)) return []
  const hand = playerOf(state, target).hand
  const [stolen] = hand.splice(randomIndex(ctx.rng, hand.length), 1)
  if (stolen === undefined) return []
  Deck.discard(state.deck, stolen, {
    onDominance: (dominanceCard: Card): void => {
      state.dominanceAvailable.push(dominanceCard)
    },
  })
  return [{ t: 'action', actor: seat, action: { type: 'botSteal', target } }]
}

function craftableItem(state: GameState, discarded: Card): ItemType | null {
  const definition = defOf(discarded)
  if (definition.type !== 'item' || definition.item === undefined) return null
  return (state.itemSupply[definition.item] ?? 0) > 0 ? definition.item : null
}

/**
 * Tinker (Day Labor): the topmost discarded card with an available item is
 * crafted for one point; the item goes to the Satchel.
 */
function dayLabor(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const discard = state.deck.discard
  const topmost = [...discard].reverse().find(
    (discarded: Card): boolean => craftableItem(state, discarded) !== null,
  )
  if (topmost === undefined) return []
  const item = craftableItem(state, topmost)
  const board = vagabotBoardOf(state, seat)
  if (item === null || !exhaustItems(board, SPECIAL_COST)) return []
  state.itemSupply[item] -= 1
  gainItem(board, item)
  ctx.emit({ s: 'craft.item', actor: seat, cardId: topmost.id, item })
  return [
    { t: 'action', actor: seat, action: { type: 'botDayLabor', cardId: topmost.id } },
    ...scoreVagabot(state, { seat, points: DAY_LABOR_VICTORY_POINTS, reason: 'craft' }, ctx),
  ]
}

/** Ranger (Hideout): three or more damaged items — slip into a random adjacent forest. */
function hideout(state: GameState, seat: Seat, ctx: Ctx): LogEntry[] {
  const board = vagabotBoardOf(state, seat)
  if (damagedItems(board).length < HIDEOUT_DAMAGED_ITEMS) return []
  if (!exhaustItems(board, SPECIAL_COST)) return []
  return slipToRandomForest(state, seat, ctx.rng)
}

/**
 * Rule: Rootbotics 7.5.6 Special — exhaust one item for the character card
 * action; skipped when it would have no effect.
 */
export function special(state: GameState, seat: Seat, ctx: Ctx): BotTaskResult {
  switch (vagabotBoardOf(state, seat).character) {
    case 'thief':
      return taskDone(steal(state, seat, ctx))
    case 'tinker':
      return taskDone(dayLabor(state, seat, ctx))
    case 'ranger':
      return taskDone(hideout(state, seat, ctx))
  }
}
