import { defOf, Deck } from '#cards/Deck.js'
import { matchesSuit } from '#cards/suit.js'
import type { Card } from '#cards/types.js'
import { undamagedSwords, boardOf as vagabondBoardOf } from '#factions/vagabond/items.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import { applyBattleEffect, hasBattleEffect } from '#effects/partisans.js'
import type { BattleEvent } from '#events/types.js'
import { applyRemovalStage } from '#events/battle/removal.js'
import type { BattleEventApply } from '#events/battle/types.js'

function clearingSuit(clearing: ClearingId): Suit {
  return FALL.clearings[clearing]!.suit
}

export function ambushCards(state: GameState, seat: Seat, clearing: ClearingId): Card[] {
  const suit: Suit = clearingSuit(clearing)
  return playerOf(state, seat).hand.filter(
    (card: Card): boolean => defOf(card).type === 'ambush' && matchesSuit(card, suit),
  )
}

function seatIsVagabond(state: GameState, seat: Seat): boolean {
  return playerOf(state, seat).faction === 'vagabond'
}

function attackerPresent(state: GameState, event: BattleEvent): boolean {
  if (seatIsVagabond(state, event.attacker)) {
    return state.clearings[event.clearing]!.pieces.some(
      (piece) => piece.kind === 'pawn' && piece.owner === event.attacker,
    )
  }
  return warriors(state, event.clearing, event.attacker) > 0
}

/** Rule: Battle — max rolled hits = warriors, or undamaged swords for Vagabond. */
function hitCap(state: GameState, clearing: ClearingId, seat: Seat): number {
  if (seatIsVagabond(state, seat)) {
    return undamagedSwords(vagabondBoardOf(state, seat))
  }
  return warriors(state, clearing, seat)
}

function sideOf(seat: Seat, event: BattleEvent): 'attacker' | 'defender' | null {
  if (seat === event.attacker) return 'attacker'
  if (seat === event.defender) return 'defender'
  return null
}

function capHits(hits: number, warriorsInClearing: number): number {
  return Math.min(hits, warriorsInClearing)
}

function rollBattleDice(ctx: Ctx): [number, number] {
  const firstRoll: number = ctx.rng.roll()
  const secondRoll: number = ctx.rng.roll()
  return firstRoll >= secondRoll ? [firstRoll, secondRoll] : [secondRoll, firstRoll]
}

function finishBattle(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  const eventIndex: number = state.pending.indexOf(event)
  if (eventIndex >= 0) state.pending.splice(eventIndex, 1)
  ctx.emit({ s: 'battle.end', ev: event })
  return [{ t: 'event', event: { ...event, stage: 'removeAttacker' } }]
}

function advanceAfterAmbushRemoval(
  state: GameState,
  event: BattleEvent,
  ctx: Ctx,
): LogEntry[] {
  if (!attackerPresent(state, event)) {
    return finishBattle(state, event, ctx)
  }
  event.stage = 'roll'
  return rollStage(state, event, ctx)
}

function rollStage(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  const rolls: [number, number] = rollBattleDice(ctx)
  event.rolls = rolls
  const [high, low] = rolls
  // Rule: Alliance Guerrilla War — as defender, deal higher die; attacker deals lower.
  const defenderIsAlliance =
    playerOf(state, event.defender).faction === 'alliance'
  const attackerDie = defenderIsAlliance ? low : high
  const defenderDie = defenderIsAlliance ? high : low
  event.hits.attacker += capHits(
    attackerDie,
    hitCap(state, event.clearing, event.attacker),
  )
  event.hits.defender += capHits(
    defenderDie,
    hitCap(state, event.clearing, event.defender),
  )
  return enterEffectsPipeline(state, event, ctx)
}

function bothHaveBattleEffects(state: GameState, event: BattleEvent): boolean {
  return (
    hasBattleEffect(state, event, event.attacker) && hasBattleEffect(state, event, event.defender)
  )
}

function enterEffectsPipeline(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  if (bothHaveBattleEffects(state, event)) {
    event.stage = 'effectsOrder'
    return []
  }
  event.effectsOrder = [event.attacker, event.defender]
  return startEffectsStage(state, event, ctx)
}

function startEffectsStage(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  event.stage = 'effects'
  event.effectsUsed = {}
  return processEffectsQueue(state, event, ctx)
}

export function nextEffectSeat(event: BattleEvent): Seat | null {
  const order: Seat[] = event.effectsOrder ?? [event.attacker, event.defender]
  for (const seat of order) {
    const side: 'attacker' | 'defender' = sideOf(seat, event)!
    if (event.effectsUsed && side in event.effectsUsed) continue
    return seat
  }
  return null
}

/** Rule: Battle 3 — defenseless defender gives attacker +1 hit. */
export function applyDefenseless(state: GameState, event: BattleEvent): void {
  if (seatIsVagabond(state, event.defender)) {
    if (undamagedSwords(vagabondBoardOf(state, event.defender)) === 0) {
      event.hits.attacker += 1
    }
    return
  }
  if (warriors(state, event.clearing, event.defender) === 0) {
    event.hits.attacker += 1
  }
}

/** Rule: 7.8.3 Commander — as attacker, deal an extra hit. */
function applyCommanderBonus(state: GameState, event: BattleEvent): void {
  const board = playerOf(state, event.attacker).board
  if (board.kind === 'eyrie' && board.leader === 'commander') {
    event.hits.attacker += 1
  }
}

function finalizeHitsAndRemoval(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  applyDefenseless(state, event)
  applyCommanderBonus(state, event)
  ctx.emit({ s: 'battle.hits', ev: event, side: 'attacker' })
  ctx.emit({ s: 'battle.hits', ev: event, side: 'defender' })

  if (event.hits.attacker > 0) {
    event.stage = 'removeDefender'
    return []
  }
  if (event.hits.defender > 0) {
    event.stage = 'removeAttacker'
    return []
  }
  return finishBattle(state, event, ctx)
}

function processEffectsQueue(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  while (true) {
    const seat: Seat | null = nextEffectSeat(event)
    if (seat === null) {
      return finalizeHitsAndRemoval(state, event, ctx)
    }
    if (!hasBattleEffect(state, event, seat)) {
      const side: 'attacker' | 'defender' = sideOf(seat, event)!
      event.effectsUsed ??= {}
      event.effectsUsed[side] = false
      continue
    }
    return []
  }
}

export function applyBattleStage(
  state: GameState,
  applyInput: BattleEventApply,
  ctx: Ctx,
): LogEntry[] {
  const { event, action, actor } = applyInput
  const logs: LogEntry[] = []

  switch (event.stage) {
    case 'ambush': {
      if (actor !== event.defender) throw new RuleError('WRONG_ACTOR', { actor })
      if (action.decline) {
        logs.push(...rollStage(state, event, ctx))
        return logs
      }
      if (!action.cardId) throw new RuleError('MISSING_AMBUSH_CARD')
      const card: Card | undefined = playerOf(state, event.defender).hand.find(
        (candidate: Card): boolean => candidate.id === action.cardId,
      )
      if (!card || defOf(card).type !== 'ambush') {
        throw new RuleError('INVALID_AMBUSH', { cardId: action.cardId })
      }
      if (!matchesSuit(card, clearingSuit(event.clearing))) {
        throw new RuleError('AMBUSH_SUIT_MISMATCH', { cardId: action.cardId })
      }
      event.ambushCardId = action.cardId
      event.stage = 'foil'
      return logs
    }

    case 'foil': {
      if (actor !== event.attacker) throw new RuleError('WRONG_ACTOR', { actor })
      if (action.decline) {
        const defenderCardIndex: number = playerOf(state, event.defender).hand.findIndex(
          (card: Card): boolean => card.id === event.ambushCardId,
        )
        const ambush: Card = playerOf(state, event.defender).hand.splice(defenderCardIndex, 1)[0]!
        Deck.discard(state.deck, ambush, {
          onDominance: (card: Card): void => {
            state.dominanceAvailable.push(card)
          },
        })
        event.hits.defender = 2
        event.stage = 'removeAttacker'
        return logs
      }
      if (!action.cardId) throw new RuleError('MISSING_FOIL_CARD')
      const foil: Card | undefined = playerOf(state, event.attacker).hand.find(
        (card: Card): boolean => card.id === action.cardId,
      )
      if (!foil || defOf(foil).type !== 'ambush') {
        throw new RuleError('INVALID_FOIL', { cardId: action.cardId })
      }
      if (!matchesSuit(foil, clearingSuit(event.clearing))) {
        throw new RuleError('FOIL_SUIT_MISMATCH', { cardId: action.cardId })
      }
      const defenderCardIndex: number = playerOf(state, event.defender).hand.findIndex(
        (card: Card): boolean => card.id === event.ambushCardId,
      )
      const defenderAmbush: Card =
        playerOf(state, event.defender).hand.splice(defenderCardIndex, 1)[0]!
      Deck.discard(state.deck, defenderAmbush, {
        onDominance: (card: Card): void => {
          state.dominanceAvailable.push(card)
        },
      })
      const attackerCardIndex: number = playerOf(state, event.attacker).hand.findIndex(
        (card: Card): boolean => card.id === action.cardId,
      )
      const attackerAmbush: Card =
        playerOf(state, event.attacker).hand.splice(attackerCardIndex, 1)[0]!
      Deck.discard(state.deck, attackerAmbush, {
        onDominance: (card: Card): void => {
          state.dominanceAvailable.push(card)
        },
      })
      delete event.ambushCardId
      logs.push(...rollStage(state, event, ctx))
      return logs
    }

    case 'effectsOrder': {
      if (actor !== event.attacker) throw new RuleError('WRONG_ACTOR', { actor })
      if (!action.order || action.order.length !== 2) {
        throw new RuleError('INVALID_EFFECTS_ORDER', { order: action.order })
      }
      event.effectsOrder = action.order
      logs.push(...startEffectsStage(state, event, ctx))
      return logs
    }

    case 'effects': {
      const seat: Seat | null = nextEffectSeat(event)
      if (seat === null || actor !== seat) throw new RuleError('WRONG_ACTOR', { actor })
      const side: 'attacker' | 'defender' = sideOf(seat, event)!
      if (action.useEffect) {
        const extraHits: number = ctx.hooks.extraHits(state, event, side)
        if (extraHits > 0) {
          event.hits[side] += extraHits
        }
        applyBattleEffect(state, event, seat, ctx)
        event.effectsUsed![side] = true
      } else {
        event.effectsUsed![side] = false
      }
      logs.push(...processEffectsQueue(state, event, ctx))
      return logs
    }

    case 'removeDefender': {
      if (actor !== event.defender) throw new RuleError('WRONG_ACTOR', { actor })
      logs.push(
        ...applyRemovalStage(
          state,
          {
            event,
            action,
            victim: event.defender,
            maxHits: event.hits.attacker,
            scorer: event.attacker,
          },
          ctx,
        ),
      )
      event.hits.attacker = 0
      if (event.hits.defender > 0 && attackerPresent(state, event)) {
        event.stage = 'removeAttacker'
      } else {
        logs.push(...finishBattle(state, event, ctx))
      }
      return logs
    }

    case 'removeAttacker': {
      if (actor !== event.attacker) throw new RuleError('WRONG_ACTOR', { actor })
      logs.push(
        ...applyRemovalStage(
          state,
          {
            event,
            action,
            victim: event.attacker,
            maxHits: event.hits.defender,
            scorer: event.defender,
          },
          ctx,
        ),
      )
      event.hits.defender = 0
      if (!event.rolls) {
        logs.push(...advanceAfterAmbushRemoval(state, event, ctx))
        return logs
      }
      logs.push(...finishBattle(state, event, ctx))
      return logs
    }

    default:
      throw new RuleError('INVALID_BATTLE_STAGE', { stage: event.stage })
  }
}
