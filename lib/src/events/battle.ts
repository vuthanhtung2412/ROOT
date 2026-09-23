import type { Action, ActionSpec, ResolveEventAction } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import { Deck } from '#cards/Deck.js'
import { matchesSuit } from '#cards/suit.js'
import type { Card } from '#cards/types.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { removePieces } from '#rules/remove.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import { hasBattleEffect, applyBattleEffect } from '#effects/partisans.js'
import type { BattleEvent } from '#events/types.js'

export type RemovalSelection = {
  clearing: ClearingId
  victim: Seat
  pieceIds: string[]
  maxHits: number
}

export type RemovalStage = {
  event: BattleEvent
  action: ResolveEventAction
  victim: Seat
  maxHits: number
  scorer: Seat
}

export type OpenBattle = {
  clearing: ClearingId
  attacker: Seat
  defender: Seat
}

export type BattleEventApply = {
  event: BattleEvent
  action: ResolveEventAction
  actor: Seat
}

export type EventResolver = {
  legalActions(state: GameState, event: BattleEvent, ctx: Ctx): ActionSpec[]
  apply(state: GameState, apply: BattleEventApply, ctx: Ctx): LogEntry[]
  matchesAction(state: GameState, event: BattleEvent, action: Action, ctx: Ctx): boolean
}

function clearingSuit(clearing: ClearingId): Suit {
  return FALL.clearings[clearing]!.suit
}

function ambushCards(state: GameState, seat: Seat, clearing: ClearingId): Card[] {
  const suit = clearingSuit(clearing)
  return playerOf(state, seat).hand.filter(
    (c) => defOf(c).type === 'ambush' && matchesSuit(c, suit),
  )
}

function attackerPresent(state: GameState, event: BattleEvent): boolean {
  return warriors(state, event.clearing, event.attacker) > 0
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
  const a = ctx.rng.roll()
  const b = ctx.rng.roll()
  return a >= b ? [a, b] : [b, a]
}

function victimPieces(state: GameState, clearing: ClearingId, victim: Seat): Piece[] {
  return state.clearings[clearing]!.pieces.filter((p) => p.owner === victim)
}

/**
 * Rule: 1.4 + Battle 4.3.4 — remove exactly min(hits, pieces);
 * warriors before buildings/tokens.
 */
export function isValidRemoval(state: GameState, selection: RemovalSelection): boolean {
  const { clearing, victim, pieceIds, maxHits } = selection
  if (pieceIds.length === 0) return false
  const ids = new Set(pieceIds)
  if (ids.size !== pieceIds.length) return false

  const onBoard = victimPieces(state, clearing, victim)
  const exactRemoveCount = Math.min(maxHits, onBoard.length)
  if (pieceIds.length !== exactRemoveCount) return false

  const byId = new Map(onBoard.map((piece) => [piece.id, piece]))
  for (const id of pieceIds) {
    if (!byId.has(id)) return false
  }

  const selected = pieceIds.map((id) => byId.get(id)!)
  const boardWarriors = onBoard.filter((piece) => piece.kind === 'warrior')
  const selectedWarriors = selected.filter((piece) => piece.kind === 'warrior')
  const selectedOther = selected.filter((piece) => piece.kind !== 'warrior')
  if (selectedOther.length > 0 && selectedWarriors.length < boardWarriors.length) {
    return false
  }
  return true
}

/** Exact-size removal combos only (Rule: 1.4 + Battle 4.3.4). */
function legalRemovalSpecs(
  state: GameState,
  event: BattleEvent,
  victim: Seat,
  maxHits: number,
): ActionSpec[] {
  if (maxHits <= 0) return []
  const pieces = victimPieces(state, event.clearing, victim)
  if (pieces.length === 0) return []

  const specs: ActionSpec[] = []
  const warriorIds = pieces.filter((piece) => piece.kind === 'warrior').map((piece) => piece.id)
  const otherIds = pieces.filter((piece) => piece.kind !== 'warrior').map((piece) => piece.id)
  const exactRemoveCount = Math.min(maxHits, pieces.length)

  function addCombos(
    ids: string[],
    chooseCount: number,
    startIndex: number,
    current: string[],
    prefix: string[],
  ): void {
    if (current.length === chooseCount) {
      specs.push({
        type: 'resolveEvent',
        actor: victim,
        params: { pieceIds: [...prefix, ...current] },
      })
      return
    }
    for (let index = startIndex; index < ids.length; index += 1) {
      const pieceId = ids[index]
      if (pieceId === undefined) {
        continue
      }
      current.push(pieceId)
      addCombos(ids, chooseCount, index + 1, current, prefix)
      current.pop()
    }
  }

  if (exactRemoveCount <= warriorIds.length) {
    addCombos(warriorIds, exactRemoveCount, 0, [], [])
    return specs
  }

  const otherChooseCount = exactRemoveCount - warriorIds.length
  if (otherChooseCount > otherIds.length) {
    return []
  }
  addCombos(otherIds, otherChooseCount, 0, [], warriorIds)
  return specs
}

function applyRemovalStage(
  state: GameState,
  stage: RemovalStage,
  ctx: Ctx,
): LogEntry[] {
  const { event, action, victim, maxHits, scorer } = stage
  if (!action.pieceIds) {
    throw new RuleError('INVALID_REMOVAL', { action })
  }
  if (
    !isValidRemoval(state, {
      clearing: event.clearing,
      victim,
      pieceIds: action.pieceIds,
      maxHits,
    })
  ) {
    throw new RuleError('INVALID_REMOVAL_ORDER', { pieceIds: action.pieceIds })
  }
  return removePieces(
    state,
    {
      clearing: event.clearing,
      pieceIds: action.pieceIds,
      scorer,
      options: { fromBattle: true },
    },
    ctx,
  )
}

function finishBattle(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  const idx = state.pending.indexOf(event)
  if (idx >= 0) state.pending.splice(idx, 1)
  ctx.emit({ s: 'battle.end', ev: event })
  return [{ t: 'event', event: { ...event, stage: 'removeAttacker' } }]
}

function advanceAfterAmbushRemoval(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  if (!attackerPresent(state, event)) {
    return finishBattle(state, event, ctx)
  }
  event.stage = 'roll'
  return rollStage(state, event, ctx)
}

function rollStage(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  const rolls = rollBattleDice(ctx)
  event.rolls = rolls
  const [high, low] = rolls
  event.hits.attacker += capHits(high, warriors(state, event.clearing, event.attacker))
  event.hits.defender += capHits(low, warriors(state, event.clearing, event.defender))
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

function nextEffectSeat(event: BattleEvent): Seat | null {
  const order = event.effectsOrder ?? [event.attacker, event.defender]
  for (const seat of order) {
    const side = sideOf(seat, event)!
    if (event.effectsUsed && side in event.effectsUsed) continue
    return seat
  }
  return null
}

/** Rule: Battle 3 — defenseless defender gives attacker +1 hit. */
export function applyDefenseless(state: GameState, event: BattleEvent): void {
  if (warriors(state, event.clearing, event.defender) === 0) {
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

/** Rule: 7.8.3 Commander — as attacker, deal an extra hit. */
function applyCommanderBonus(state: GameState, event: BattleEvent): void {
  const board = playerOf(state, event.attacker).board
  if (board.kind === 'eyrie' && board.leader === 'commander') {
    event.hits.attacker += 1
  }
}

function processEffectsQueue(state: GameState, event: BattleEvent, ctx: Ctx): LogEntry[] {
  while (true) {
    const seat = nextEffectSeat(event)
    if (seat === null) {
      return finalizeHitsAndRemoval(state, event, ctx)
    }
    if (!hasBattleEffect(state, event, seat)) {
      const side = sideOf(seat, event)!
      event.effectsUsed ??= {}
      event.effectsUsed[side] = false
      continue
    }
    return []
  }
}

export const battleResolver: EventResolver = {
  matchesAction(state, event, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    return this.legalActions(state, event, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent') return false
      if (spec.actor !== undefined && action.type === 'resolveEvent') {
        // match params
        if (action.decline && spec.params?.decline?.includes(true)) return true
        if (action.order && spec.params?.order) {
          return JSON.stringify(action.order) === JSON.stringify(spec.params.order[0])
        }
        if (action.cardId && spec.params?.cardIds?.includes(action.cardId)) return true
        if (action.pieceIds && spec.params?.pieceIds) {
          const domain = spec.params.pieceIds
          // legalRemovalSpecs stores one combo per spec as a flat string[]
          if (JSON.stringify(action.pieceIds) === JSON.stringify(domain)) return true
          // also allow domain as list-of-combos
          return domain.some(
            (ids) =>
              Array.isArray(ids) && JSON.stringify(ids) === JSON.stringify(action.pieceIds),
          )
        }
        if (action.useEffect !== undefined && spec.params?.useEffect?.includes(action.useEffect)) {
          return true
        }
      }
      return false
    })
  },

  legalActions(state, event, _ctx) {
    switch (event.stage) {
      case 'ambush': {
        const specs: ActionSpec[] = [{ type: 'resolveEvent', actor: event.defender, params: { decline: [true] } }]
        for (const c of ambushCards(state, event.defender, event.clearing)) {
          specs.push({
            type: 'resolveEvent',
            actor: event.defender,
            params: { cardIds: [c.id] },
          })
        }
        return specs
      }
      case 'foil': {
        const specs: ActionSpec[] = [{ type: 'resolveEvent', actor: event.attacker, params: { decline: [true] } }]
        for (const c of ambushCards(state, event.attacker, event.clearing)) {
          specs.push({
            type: 'resolveEvent',
            actor: event.attacker,
            params: { cardIds: [c.id] },
          })
        }
        return specs
      }
      case 'effectsOrder': {
        return [
          {
            type: 'resolveEvent',
            actor: event.attacker,
            params: { order: [[event.attacker, event.defender], [event.defender, event.attacker]] },
          },
        ]
      }
      case 'effects': {
        const seat = nextEffectSeat(event)
        if (seat === null) return []
        if (!hasBattleEffect(state, event, seat)) return []
        return [
          { type: 'resolveEvent', actor: seat, params: { useEffect: [false] } },
          { type: 'resolveEvent', actor: seat, params: { useEffect: [true] } },
        ]
      }
      case 'removeDefender':
        return legalRemovalSpecs(state, event, event.defender, event.hits.attacker)
      case 'removeAttacker':
        return legalRemovalSpecs(state, event, event.attacker, event.hits.defender)
      case 'roll':
        return []
      default:
        return []
    }
  },

  apply(state, { event, action, actor }, ctx) {
    const logs: LogEntry[] = []

    switch (event.stage) {
      case 'ambush': {
        if (actor !== event.defender) throw new RuleError('WRONG_ACTOR', { actor })
        if (action.decline) {
          logs.push(...rollStage(state, event, ctx))
          return logs
        }
        if (!action.cardId) throw new RuleError('MISSING_AMBUSH_CARD')
        const card = playerOf(state, event.defender).hand.find((c) => c.id === action.cardId)
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
          const idx = playerOf(state, event.defender).hand.findIndex((c) => c.id === event.ambushCardId)
          const ambush = playerOf(state, event.defender).hand.splice(idx, 1)[0]!
          Deck.discard(state.deck, ambush, {
            onDominance: (c) => state.dominanceAvailable.push(c),
          })
          event.hits.defender = 2
          event.stage = 'removeAttacker'
          return logs
        }
        if (!action.cardId) throw new RuleError('MISSING_FOIL_CARD')
        const foil = playerOf(state, event.attacker).hand.find((c) => c.id === action.cardId)
        if (!foil || defOf(foil).type !== 'ambush') {
          throw new RuleError('INVALID_FOIL', { cardId: action.cardId })
        }
        if (!matchesSuit(foil, clearingSuit(event.clearing))) {
          throw new RuleError('FOIL_SUIT_MISMATCH', { cardId: action.cardId })
        }
        const defIdx = playerOf(state, event.defender).hand.findIndex((c) => c.id === event.ambushCardId)
        const defAmbush = playerOf(state, event.defender).hand.splice(defIdx, 1)[0]!
        Deck.discard(state.deck, defAmbush, {
          onDominance: (c) => state.dominanceAvailable.push(c),
        })
        const atkIdx = playerOf(state, event.attacker).hand.findIndex((c) => c.id === action.cardId)
        const atkAmbush = playerOf(state, event.attacker).hand.splice(atkIdx, 1)[0]!
        Deck.discard(state.deck, atkAmbush, {
          onDominance: (c) => state.dominanceAvailable.push(c),
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
        const seat = nextEffectSeat(event)
        if (seat === null || actor !== seat) throw new RuleError('WRONG_ACTOR', { actor })
        const side = sideOf(seat, event)!
        if (action.useEffect) {
          const extra = ctx.hooks.extraHits(state, event, side)
          if (extra > 0) {
            event.hits[side] += extra
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
  },
}

export function openBattle(
  state: GameState,
  open: OpenBattle,
  ctx: Ctx,
): LogEntry[] {
  const { clearing, attacker, defender } = open
  const event: BattleEvent = {
    type: 'battle',
    clearing,
    attacker,
    defender,
    stage: 'ambush',
    hits: { attacker: 0, defender: 0 },
  }
  state.pending.push(event)
  ctx.emit({ s: 'battle.start', ev: event })
  return [{ t: 'event', event }]
}
