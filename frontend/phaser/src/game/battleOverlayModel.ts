import type { GameState } from '#api/client.ts'
import type { BattleOverlayViewModel } from '#ui/BattleOverlay.ts'

export const ZERO_HIT_BATTLE_MESSAGE = 'Battle over — no hits'

const ZERO_HIT_FLASH_MS = 2400

type BattlePending = {
  clearing: number
  stage: string
  attacker: number
  defender: number
  rolls: readonly [number, number] | null
  hits: { attacker: number; defender: number }
}

export type BattleTrackerState = {
  clearing: number
  attacker: number
  defender: number
  rolls: readonly [number, number] | null
  peakHits: { attacker: number; defender: number }
}

export type ZeroHitBattleOutcome = {
  clearing: number
  attacker: number
  defender: number
  rolls: readonly [number, number]
}

export type BattleTrackerUpdate = {
  tracker: BattleTrackerState | null
  zeroHitOutcome: ZeroHitBattleOutcome | null
}

/**
 * Read first pending battle into overlay view-model.
 */
export function buildBattleOverlayViewModel(
  state: GameState,
  prompt: string | null = null,
): BattleOverlayViewModel | null {
  const battle = readBattlePending(state.pending[0])
  if (battle === null) {
    return null
  }
  return {
    clearing: battle.clearing,
    stage: battle.stage,
    attackerFaction: factionLabel(state, battle.attacker),
    defenderFaction: factionLabel(state, battle.defender),
    rolls: battle.rolls,
    hits: battle.hits,
    prompt,
    outcomeMessage: null,
  }
}

export function buildZeroHitBattleOverlayViewModel(
  state: GameState,
  outcome: ZeroHitBattleOutcome,
): BattleOverlayViewModel {
  return {
    clearing: outcome.clearing,
    stage: 'finished',
    attackerFaction: factionLabel(state, outcome.attacker),
    defenderFaction: factionLabel(state, outcome.defender),
    rolls: outcome.rolls,
    hits: { attacker: 0, defender: 0 },
    prompt: null,
    outcomeMessage: ZERO_HIT_BATTLE_MESSAGE,
  }
}

export function readBattleClearingId(state: GameState): number | null {
  const battle = readBattlePending(state.pending[0])
  return battle?.clearing ?? null
}

export function zeroHitFlashDurationMs(): number {
  return ZERO_HIT_FLASH_MS
}

/**
 * Track pending battle peaks; when battle clears with rolls but no hits dealt, signal UI flash.
 */
export function updateBattleTracker(
  tracker: BattleTrackerState | null,
  state: GameState,
): BattleTrackerUpdate {
  const pending = readBattlePending(state.pending[0])
  if (pending !== null) {
    return {
      tracker: mergeBattleTracker(tracker, pending),
      zeroHitOutcome: null,
    }
  }
  const zeroHitOutcome = detectZeroHitBattleOutcome(tracker)
  return { tracker: null, zeroHitOutcome }
}

function mergeBattleTracker(
  tracker: BattleTrackerState | null,
  pending: BattlePending,
): BattleTrackerState {
  const sameBattle =
    tracker !== null &&
    tracker.clearing === pending.clearing &&
    tracker.attacker === pending.attacker &&
    tracker.defender === pending.defender
  const peakHits = sameBattle
    ? {
        attacker: Math.max(tracker.peakHits.attacker, pending.hits.attacker),
        defender: Math.max(tracker.peakHits.defender, pending.hits.defender),
      }
    : { attacker: pending.hits.attacker, defender: pending.hits.defender }
  const rolls = pending.rolls ?? (sameBattle ? tracker.rolls : null)
  return {
    clearing: pending.clearing,
    attacker: pending.attacker,
    defender: pending.defender,
    rolls,
    peakHits,
  }
}

function detectZeroHitBattleOutcome(
  tracker: BattleTrackerState | null,
): ZeroHitBattleOutcome | null {
  if (tracker === null || tracker.rolls === null) {
    return null
  }
  if (tracker.peakHits.attacker > 0 || tracker.peakHits.defender > 0) {
    return null
  }
  return {
    clearing: tracker.clearing,
    attacker: tracker.attacker,
    defender: tracker.defender,
    rolls: tracker.rolls,
  }
}

function factionLabel(state: GameState, seat: number): string {
  const player = state.players.find((entry) => entry.seat === seat)
  return player?.faction ?? state.factions[seat] ?? `seat ${String(seat)}`
}

function readBattlePending(event: unknown): BattlePending | null {
  if (typeof event !== 'object' || event === null) {
    return null
  }
  if (Reflect.get(event, 'type') !== 'battle') {
    return null
  }
  const clearing = Reflect.get(event, 'clearing')
  const stage = Reflect.get(event, 'stage')
  const attacker = Reflect.get(event, 'attacker')
  const defender = Reflect.get(event, 'defender')
  const hitsRaw = Reflect.get(event, 'hits')
  if (
    typeof clearing !== 'number' ||
    typeof stage !== 'string' ||
    typeof attacker !== 'number' ||
    typeof defender !== 'number' ||
    typeof hitsRaw !== 'object' ||
    hitsRaw === null
  ) {
    return null
  }
  const attackerHits = Reflect.get(hitsRaw, 'attacker')
  const defenderHits = Reflect.get(hitsRaw, 'defender')
  if (typeof attackerHits !== 'number' || typeof defenderHits !== 'number') {
    return null
  }

  return {
    clearing,
    stage,
    attacker,
    defender,
    rolls: readRolls(Reflect.get(event, 'rolls')),
    hits: { attacker: attackerHits, defender: defenderHits },
  }
}

function readRolls(value: unknown): readonly [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null
  }
  const high = value[0]
  const low = value[1]
  if (typeof high !== 'number' || typeof low !== 'number') {
    return null
  }
  return [high, low]
}
