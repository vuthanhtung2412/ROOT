import type { Action, ActionSpec } from '#actions/types.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { GameState } from '#state/types.js'
import { hasBattleEffect } from '#effects/partisans.js'
import {
  boardOf as vagabondBoardOf,
  isValidItemDamageChoice,
} from '#factions/vagabond/items.js'
import type { BattleEvent } from '#events/types.js'
import { legalRemovalSpecs } from '#events/battle/removal.js'
import { isBotSeat } from '#factions/bots/botFactions.js'
import {
  ambushCards,
  applyBattleStage,
  nextEffectSeat,
} from '#events/battle/stages.js'
import type {
  BattleEventApply,
  EventResolver,
  OpenBattle,
} from '#events/battle/types.js'

const MAX_FORCED_BATTLE_STEPS = 32

function legalBattleActions(
  state: GameState,
  event: BattleEvent,
  _ctx: Ctx,
): ActionSpec[] {
  switch (event.stage) {
    case 'ambush': {
      const specs: ActionSpec[] = [
        { type: 'resolveEvent', actor: event.defender, params: { decline: [true] } },
      ]
      // Rule: Rootbotics 2.8.2 Hates Surprises — no ambush against bots.
      if (isBotSeat(state, event.attacker)) return specs
      for (const card of ambushCards(state, event.defender, event.clearing)) {
        specs.push({
          type: 'resolveEvent',
          actor: event.defender,
          params: { cardIds: [card.id] },
        })
      }
      return specs
    }
    case 'foil': {
      const specs: ActionSpec[] = [
        { type: 'resolveEvent', actor: event.attacker, params: { decline: [true] } },
      ]
      for (const card of ambushCards(state, event.attacker, event.clearing)) {
        specs.push({
          type: 'resolveEvent',
          actor: event.attacker,
          params: { cardIds: [card.id] },
        })
      }
      return specs
    }
    case 'effectsOrder':
      return [
        {
          type: 'resolveEvent',
          actor: event.attacker,
          params: {
            order: [
              [event.attacker, event.defender],
              [event.defender, event.attacker],
            ],
          },
        },
      ]
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
}

function matchesBattleAction(
  state: GameState,
  event: BattleEvent,
  action: Action,
  ctx: Ctx,
): boolean {
  if (action.type !== 'resolveEvent') return false
  return legalBattleActions(state, event, ctx).some((spec: ActionSpec): boolean => {
    if (spec.type !== 'resolveEvent') return false
    if (spec.actor !== undefined) {
      if (action.decline && spec.params?.decline?.includes(true)) return true
      if (action.order && spec.params?.order) {
        return JSON.stringify(action.order) === JSON.stringify(spec.params.order[0])
      }
      if (action.cardId && spec.params?.cardIds?.includes(action.cardId)) return true
      if (action.pieceIds && spec.params?.pieceIds) {
        const domain = spec.params.pieceIds
        if (JSON.stringify(action.pieceIds) === JSON.stringify(domain)) return true
        return domain.some(
          (ids: string | string[]): boolean =>
            Array.isArray(ids) && JSON.stringify(ids) === JSON.stringify(action.pieceIds),
        )
      }
      if (action.useEffect !== undefined && spec.params?.useEffect?.includes(action.useEffect)) {
        return true
      }
      if (action.items !== undefined && spec.params?.vagabondItems !== undefined) {
        return isValidItemDamageChoice(
          vagabondBoardOf(state, spec.actor),
          action.items,
          spec.params.itemCount?.[0] ?? 0,
        )
      }
    }
    return false
  })
}

function isStringIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry: unknown): boolean => typeof entry === 'string')
}

/**
 * No-choice battle steps (sole removal combo) resolve in the same apply so
 * clients get one snapshot instead of auto-skip blink chains.
 * Ambush/foil never auto-decline — player always confirms Skip.
 */
function soleForcedBattleResolve(
  state: GameState,
  event: BattleEvent,
  ctx: Ctx,
): BattleEventApply | null {
  // Rule: Rootbotics 2.8.1 / 2.8.2 — no ambush against a bot, and a bot holds
  // no ambush: nothing to ask.
  if (
    event.stage === 'ambush' &&
    (isBotSeat(state, event.attacker) || isBotSeat(state, event.defender))
  ) {
    return {
      event,
      actor: event.defender,
      action: { type: 'resolveEvent', decline: true },
    }
  }
  // Always wait for player Skip/play — even with empty hand (no auto-decline).
  if (event.stage === 'ambush' || event.stage === 'foil') {
    return null
  }

  const specs: ActionSpec[] = legalBattleActions(state, event, ctx)
  if (specs.length !== 1) {
    return null
  }
  const spec: ActionSpec | undefined = specs[0]
  if (spec === undefined || spec.type !== 'resolveEvent') {
    return null
  }
  const actor = spec.actor
  if (actor === undefined) {
    return null
  }

  if (event.stage === 'removeDefender' || event.stage === 'removeAttacker') {
    // Rule: Vagabond hits → sole decline acknowledges item damage.
    if (spec.params?.decline?.[0] === true) {
      return {
        event,
        actor,
        action: { type: 'resolveEvent', decline: true },
      }
    }
    const pieceIds = spec.params?.pieceIds
    if (!isStringIdList(pieceIds)) {
      return null
    }
    return {
      event,
      actor,
      action: { type: 'resolveEvent', pieceIds },
    }
  }

  return null
}

function drainForcedBattleSteps(
  state: GameState,
  event: BattleEvent,
  ctx: Ctx,
): LogEntry[] {
  const logs: LogEntry[] = []
  for (let step = 0; step < MAX_FORCED_BATTLE_STEPS; step += 1) {
    if (!state.pending.includes(event)) {
      break
    }
    const forced: BattleEventApply | null = soleForcedBattleResolve(state, event, ctx)
    if (forced === null) {
      break
    }
    logs.push(...applyBattleStage(state, forced, ctx))
  }
  return logs
}

function applyBattle(
  state: GameState,
  applyInput: BattleEventApply,
  ctx: Ctx,
): LogEntry[] {
  const logs: LogEntry[] = applyBattleStage(state, applyInput, ctx)
  logs.push(...drainForcedBattleSteps(state, applyInput.event, ctx))
  return logs
}

export const battleResolver: EventResolver = {
  matchesAction: matchesBattleAction,
  legalActions: legalBattleActions,
  apply: applyBattle,
}

export function openBattle(state: GameState, open: OpenBattle, ctx: Ctx): LogEntry[] {
  const { clearing, attacker, defender, alliedSeat } = open
  const event: BattleEvent = {
    type: 'battle',
    clearing,
    attacker,
    defender,
    stage: 'ambush',
    hits: { attacker: 0, defender: 0 },
    alliedHitsTaken: 0,
    itemHitsTaken: 0,
  }
  if (alliedSeat !== undefined) {
    event.alliedSeat = alliedSeat
  }
  if (open.attackerExtraHits !== undefined) {
    event.attackerExtraHits = open.attackerExtraHits
  }
  state.pending.push(event)
  ctx.emit({ s: 'battle.start', ev: event })
  const logs: LogEntry[] = [{ t: 'event', event }]
  logs.push(...drainForcedBattleSteps(state, event, ctx))
  return logs
}
