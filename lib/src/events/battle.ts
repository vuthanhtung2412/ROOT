import type { Action, ActionSpec, ResolveEventAction } from '../actions/types.js'
import { defOf } from '../cards/Deck.js'
import { Deck } from '../cards/Deck.js'
import { matchesSuit } from '../cards/suit.js'
import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import { FALL } from '../map/fall.js'
import type { ClearingId } from '../map/types.js'
import type { Piece, Seat } from '../pieces/types.js'
import { warriors } from '../queries/pieces.js'
import { playerOf } from '../queries/seat.js'
import { removePieces, returnWarriorsToSupply } from '../rules/remove.js'
import { RuleError } from '../rules/RuleError.js'
import type { GameState } from '../state/types.js'
import { hasBattleEffect, applyBattleEffect } from '../effects/partisans.js'
import type { BattleEvent } from './types.js'

export type EventResolver = {
  legalActions(state: GameState, ev: BattleEvent, ctx: Ctx): ActionSpec[]
  apply(
    state: GameState,
    ev: BattleEvent,
    action: ResolveEventAction,
    actor: Seat,
    ctx: Ctx,
  ): LogEntry[]
  matchesAction(state: GameState, ev: BattleEvent, action: Action, ctx: Ctx): boolean
}

function clearingSuit(clearing: ClearingId) {
  return FALL.clearings[clearing]!.suit
}

function ambushCards(state: GameState, seat: Seat, clearing: ClearingId) {
  const suit = clearingSuit(clearing)
  return playerOf(state, seat).hand.filter(
    (c) => defOf(c).type === 'ambush' && matchesSuit(c, suit),
  )
}

function attackerPresent(state: GameState, ev: BattleEvent): boolean {
  return warriors(state, ev.clearing, ev.attacker) > 0
}

function sideOf(seat: Seat, ev: BattleEvent): 'attacker' | 'defender' | null {
  if (seat === ev.attacker) return 'attacker'
  if (seat === ev.defender) return 'defender'
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

/** Rule: Battle 4 — warriors removed before buildings/tokens. */
export function isValidRemoval(
  state: GameState,
  clearing: ClearingId,
  victim: Seat,
  pieceIds: string[],
  maxHits: number,
): boolean {
  if (pieceIds.length === 0 || pieceIds.length > maxHits) return false
  const ids = new Set(pieceIds)
  if (ids.size !== pieceIds.length) return false

  const onBoard = victimPieces(state, clearing, victim)
  const byId = new Map(onBoard.map((p) => [p.id, p]))
  for (const id of pieceIds) {
    if (!byId.has(id)) return false
  }

  const selected = pieceIds.map((id) => byId.get(id)!)
  const boardWarriors = onBoard.filter((p) => p.kind === 'warrior')
  const selectedWarriors = selected.filter((p) => p.kind === 'warrior')
  const selectedOther = selected.filter((p) => p.kind !== 'warrior')
  if (selectedOther.length > 0 && selectedWarriors.length < boardWarriors.length) {
    return false
  }
  return true
}

function legalRemovalSpecs(
  state: GameState,
  ev: BattleEvent,
  victim: Seat,
  maxHits: number,
): ActionSpec[] {
  if (maxHits <= 0) return []
  const pieces = victimPieces(state, ev.clearing, victim)
  if (pieces.length === 0) return []

  const specs: ActionSpec[] = []
  const warriorIds = pieces.filter((p) => p.kind === 'warrior').map((p) => p.id)
  const otherIds = pieces.filter((p) => p.kind !== 'warrior').map((p) => p.id)

  const maxRemove = Math.min(maxHits, pieces.length)

  function addCombos(ids: string[], k: number, start: number, cur: string[]) {
    if (cur.length === k) {
      specs.push({
        type: 'resolveEvent',
        actor: victim,
        params: { pieceIds: [...cur] },
      })
      return
    }
    for (let i = start; i < ids.length; i++) {
      cur.push(ids[i]!)
      addCombos(ids, k, i + 1, cur)
      cur.pop()
    }
  }

  for (let k = 1; k <= Math.min(maxRemove, warriorIds.length); k++) {
    addCombos(warriorIds, k, 0, [])
  }
  if (warriorIds.length <= maxRemove) {
    for (let k = 1; k <= Math.min(maxRemove - warriorIds.length, otherIds.length); k++) {
      addCombos(otherIds, k, 0, [])
    }
    if (warriorIds.length + otherIds.length <= maxRemove && otherIds.length > 0) {
      specs.push({
        type: 'resolveEvent',
        actor: victim,
        params: { pieceIds: [...warriorIds, ...otherIds] },
      })
    }
  }

  return specs
}

function applyRemovalStage(
  state: GameState,
  ev: BattleEvent,
  action: ResolveEventAction,
  victim: Seat,
  maxHits: number,
  scorer: Seat,
  ctx: Ctx,
): LogEntry[] {
  if (!action.pieceIds) {
    throw new RuleError('INVALID_REMOVAL', { action })
  }
  if (!isValidRemoval(state, ev.clearing, victim, action.pieceIds, maxHits)) {
    throw new RuleError('INVALID_REMOVAL_ORDER', { pieceIds: action.pieceIds })
  }
  const logs = removePieces(state, ev.clearing, action.pieceIds, scorer, ctx)
  return logs
}

function finishBattle(state: GameState, ev: BattleEvent, ctx: Ctx): LogEntry[] {
  const idx = state.pending.indexOf(ev)
  if (idx >= 0) state.pending.splice(idx, 1)
  ctx.emit({ s: 'battle.end', ev })
  return [{ t: 'event', event: { ...ev, stage: 'removeAttacker' } }]
}

function advanceAfterAmbushRemoval(state: GameState, ev: BattleEvent, ctx: Ctx): LogEntry[] {
  if (!attackerPresent(state, ev)) {
    return finishBattle(state, ev, ctx)
  }
  ev.stage = 'roll'
  return rollStage(state, ev, ctx)
}

function rollStage(state: GameState, ev: BattleEvent, ctx: Ctx): LogEntry[] {
  const rolls = rollBattleDice(ctx)
  ev.rolls = rolls
  const [high, low] = rolls
  ev.hits.attacker += capHits(high, warriors(state, ev.clearing, ev.attacker))
  ev.hits.defender += capHits(low, warriors(state, ev.clearing, ev.defender))
  return enterEffectsPipeline(state, ev, ctx)
}

function bothHaveBattleEffects(state: GameState, ev: BattleEvent): boolean {
  return (
    hasBattleEffect(state, ev, ev.attacker) && hasBattleEffect(state, ev, ev.defender)
  )
}

function enterEffectsPipeline(state: GameState, ev: BattleEvent, ctx: Ctx): LogEntry[] {
  if (bothHaveBattleEffects(state, ev)) {
    ev.stage = 'effectsOrder'
    return []
  }
  ev.effectsOrder = [ev.attacker, ev.defender]
  return startEffectsStage(state, ev, ctx)
}

function startEffectsStage(state: GameState, ev: BattleEvent, ctx: Ctx): LogEntry[] {
  ev.stage = 'effects'
  ev.effectsUsed = {}
  return processEffectsQueue(state, ev, ctx)
}

function nextEffectSeat(ev: BattleEvent): Seat | null {
  const order = ev.effectsOrder ?? [ev.attacker, ev.defender]
  for (const seat of order) {
    const side = sideOf(seat, ev)!
    if (ev.effectsUsed && side in ev.effectsUsed) continue
    return seat
  }
  return null
}

/** Rule: Battle 3 — defenseless defender gives attacker +1 hit. */
export function applyDefenseless(state: GameState, ev: BattleEvent): void {
  if (warriors(state, ev.clearing, ev.defender) === 0) {
    ev.hits.attacker += 1
  }
}

function finalizeHitsAndRemoval(state: GameState, ev: BattleEvent, ctx: Ctx): LogEntry[] {
  applyDefenseless(state, ev)
  ctx.emit({ s: 'battle.hits', ev, side: 'attacker' })
  ctx.emit({ s: 'battle.hits', ev, side: 'defender' })

  if (ev.hits.attacker > 0) {
    ev.stage = 'removeDefender'
    return []
  }
  if (ev.hits.defender > 0) {
    ev.stage = 'removeAttacker'
    return []
  }
  return finishBattle(state, ev, ctx)
}

function processEffectsQueue(state: GameState, ev: BattleEvent, ctx: Ctx): LogEntry[] {
  while (true) {
    const seat = nextEffectSeat(ev)
    if (seat === null) {
      return finalizeHitsAndRemoval(state, ev, ctx)
    }
    if (!hasBattleEffect(state, ev, seat)) {
      const side = sideOf(seat, ev)!
      ev.effectsUsed ??= {}
      ev.effectsUsed[side] = false
      continue
    }
    return []
  }
}

export const battleResolver: EventResolver = {
  matchesAction(state, ev, action, ctx) {
    if (action.type !== 'resolveEvent') return false
    return this.legalActions(state, ev, ctx).some((spec) => {
      if (spec.type !== 'resolveEvent') return false
      if (spec.actor !== undefined && action.type === 'resolveEvent') {
        // match params
        if (action.decline && spec.params?.decline?.includes(true)) return true
        if (action.order && spec.params?.order) {
          return JSON.stringify(action.order) === JSON.stringify(spec.params.order[0])
        }
        if (action.cardId && spec.params?.cardIds?.includes(action.cardId)) return true
        if (action.pieceIds && spec.params?.pieceIds) {
          return (
            JSON.stringify(action.pieceIds) === JSON.stringify(spec.params.pieceIds[0]) ||
            spec.params.pieceIds.some(
              (ids) => JSON.stringify(ids) === JSON.stringify(action.pieceIds),
            )
          )
        }
        if (action.useEffect !== undefined && spec.params?.useEffect?.includes(action.useEffect)) {
          return true
        }
      }
      return false
    })
  },

  legalActions(state, ev, ctx) {
    switch (ev.stage) {
      case 'ambush': {
        const specs: ActionSpec[] = [{ type: 'resolveEvent', actor: ev.defender, params: { decline: [true] } }]
        for (const c of ambushCards(state, ev.defender, ev.clearing)) {
          specs.push({
            type: 'resolveEvent',
            actor: ev.defender,
            params: { cardIds: [c.id] },
          })
        }
        return specs
      }
      case 'foil': {
        const specs: ActionSpec[] = [{ type: 'resolveEvent', actor: ev.attacker, params: { decline: [true] } }]
        for (const c of ambushCards(state, ev.attacker, ev.clearing)) {
          specs.push({
            type: 'resolveEvent',
            actor: ev.attacker,
            params: { cardIds: [c.id] },
          })
        }
        return specs
      }
      case 'effectsOrder': {
        return [
          {
            type: 'resolveEvent',
            actor: ev.attacker,
            params: { order: [[ev.attacker, ev.defender], [ev.defender, ev.attacker]] },
          },
        ]
      }
      case 'effects': {
        const seat = nextEffectSeat(ev)
        if (seat === null) return []
        const side = sideOf(seat, ev)!
        if (!hasBattleEffect(state, ev, seat)) return []
        return [
          { type: 'resolveEvent', actor: seat, params: { useEffect: [false] } },
          { type: 'resolveEvent', actor: seat, params: { useEffect: [true] } },
        ]
      }
      case 'removeDefender':
        return legalRemovalSpecs(state, ev, ev.defender, ev.hits.attacker)
      case 'removeAttacker':
        return legalRemovalSpecs(state, ev, ev.attacker, ev.hits.defender)
      case 'roll':
        return []
      default:
        return []
    }
  },

  apply(state, ev, action, actor, ctx) {
    const logs: LogEntry[] = []

    switch (ev.stage) {
      case 'ambush': {
        if (actor !== ev.defender) throw new RuleError('WRONG_ACTOR', { actor })
        if (action.decline) {
          logs.push(...rollStage(state, ev, ctx))
          return logs
        }
        if (!action.cardId) throw new RuleError('MISSING_AMBUSH_CARD')
        const card = playerOf(state, ev.defender).hand.find((c) => c.id === action.cardId)
        if (!card || defOf(card).type !== 'ambush') {
          throw new RuleError('INVALID_AMBUSH', { cardId: action.cardId })
        }
        if (!matchesSuit(card, clearingSuit(ev.clearing))) {
          throw new RuleError('AMBUSH_SUIT_MISMATCH', { cardId: action.cardId })
        }
        ev.ambushCardId = action.cardId
        ev.stage = 'foil'
        return logs
      }

      case 'foil': {
        if (actor !== ev.attacker) throw new RuleError('WRONG_ACTOR', { actor })
        if (action.decline) {
          const idx = playerOf(state, ev.defender).hand.findIndex((c) => c.id === ev.ambushCardId)
          const ambush = playerOf(state, ev.defender).hand.splice(idx, 1)[0]!
          Deck.discard(state.deck, ambush, {
            onDominance: (c) => state.dominanceAvailable.push(c),
          })
          ev.hits.defender = 2
          ev.stage = 'removeAttacker'
          return logs
        }
        if (!action.cardId) throw new RuleError('MISSING_FOIL_CARD')
        const foil = playerOf(state, ev.attacker).hand.find((c) => c.id === action.cardId)
        if (!foil || defOf(foil).type !== 'ambush') {
          throw new RuleError('INVALID_FOIL', { cardId: action.cardId })
        }
        if (!matchesSuit(foil, clearingSuit(ev.clearing))) {
          throw new RuleError('FOIL_SUIT_MISMATCH', { cardId: action.cardId })
        }
        const defIdx = playerOf(state, ev.defender).hand.findIndex((c) => c.id === ev.ambushCardId)
        const defAmbush = playerOf(state, ev.defender).hand.splice(defIdx, 1)[0]!
        Deck.discard(state.deck, defAmbush, {
          onDominance: (c) => state.dominanceAvailable.push(c),
        })
        const atkIdx = playerOf(state, ev.attacker).hand.findIndex((c) => c.id === action.cardId)
        const atkAmbush = playerOf(state, ev.attacker).hand.splice(atkIdx, 1)[0]!
        Deck.discard(state.deck, atkAmbush, {
          onDominance: (c) => state.dominanceAvailable.push(c),
        })
        delete ev.ambushCardId
        logs.push(...rollStage(state, ev, ctx))
        return logs
      }

      case 'effectsOrder': {
        if (actor !== ev.attacker) throw new RuleError('WRONG_ACTOR', { actor })
        if (!action.order || action.order.length !== 2) {
          throw new RuleError('INVALID_EFFECTS_ORDER', { order: action.order })
        }
        ev.effectsOrder = action.order
        logs.push(...startEffectsStage(state, ev, ctx))
        return logs
      }

      case 'effects': {
        const seat = nextEffectSeat(ev)
        if (seat === null || actor !== seat) throw new RuleError('WRONG_ACTOR', { actor })
        const side = sideOf(seat, ev)!
        if (action.useEffect) {
          const extra = ctx.hooks.extraHits(state, ev, side)
          if (extra > 0) {
            ev.hits[side] += extra
          }
          applyBattleEffect(state, ev, seat, ctx)
          ev.effectsUsed![side] = true
        } else {
          ev.effectsUsed![side] = false
        }
        logs.push(...processEffectsQueue(state, ev, ctx))
        return logs
      }

      case 'removeDefender': {
        if (actor !== ev.defender) throw new RuleError('WRONG_ACTOR', { actor })
        logs.push(
          ...applyRemovalStage(state, ev, action, ev.defender, ev.hits.attacker, ev.attacker, ctx),
        )
        ev.hits.attacker = 0
        if (ev.hits.defender > 0 && attackerPresent(state, ev)) {
          ev.stage = 'removeAttacker'
        } else {
          logs.push(...finishBattle(state, ev, ctx))
        }
        return logs
      }

      case 'removeAttacker': {
        if (actor !== ev.attacker) throw new RuleError('WRONG_ACTOR', { actor })
        logs.push(
          ...applyRemovalStage(state, ev, action, ev.attacker, ev.hits.defender, ev.defender, ctx),
        )
        ev.hits.defender = 0
        if (!ev.rolls) {
          logs.push(...advanceAfterAmbushRemoval(state, ev, ctx))
          return logs
        }
        logs.push(...finishBattle(state, ev, ctx))
        return logs
      }

      default:
        throw new RuleError('INVALID_BATTLE_STAGE', { stage: ev.stage })
    }
  },
}

export function openBattle(
  state: GameState,
  clearing: ClearingId,
  attacker: Seat,
  defender: Seat,
  ctx: Ctx,
): LogEntry[] {
  const ev: BattleEvent = {
    type: 'battle',
    clearing,
    attacker,
    defender,
    stage: 'ambush',
    hits: { attacker: 0, defender: 0 },
  }
  state.pending.push(ev)
  ctx.emit({ s: 'battle.start', ev })
  return [{ t: 'event', event: ev }]
}
