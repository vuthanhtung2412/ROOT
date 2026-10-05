/** Narrow pending shapes from opaque GameState.pending JSON. */

export type BattleStage =
  | 'ambush'
  | 'foil'
  | 'roll'
  | 'effectsOrder'
  | 'effects'
  | 'removeDefender'
  | 'removeAttacker'

export type BattlePendingEvent = {
  type: 'battle'
  stage: BattleStage
  attacker: number
  defender: number
  effectsOrder?: number[]
  effectsUsed?: Partial<Record<'attacker' | 'defender', boolean>>
}

export type FieldHospitalPendingEvent = {
  type: 'fieldHospital'
  victim: number
}

export type ChooseKeepPendingEvent = {
  type: 'chooseKeep'
  seat: number
}

export type PlaceStartingBuildingPendingEvent = {
  type: 'placeStartingBuilding'
  seat: number
  building: string
}

export type ChooseLeaderPendingEvent = {
  type: 'chooseLeader'
  seat: number
}

export type ChooseCharacterPendingEvent = {
  type: 'chooseCharacter'
  seat: number
}

export type ChooseForestPendingEvent = {
  type: 'chooseForest'
  seat: number
}

export type KnownPendingEvent =
  | BattlePendingEvent
  | FieldHospitalPendingEvent
  | ChooseKeepPendingEvent
  | PlaceStartingBuildingPendingEvent
  | ChooseLeaderPendingEvent
  | ChooseCharacterPendingEvent
  | ChooseForestPendingEvent

const BATTLE_STAGES = new Set<string>([
  'ambush',
  'foil',
  'roll',
  'effectsOrder',
  'effects',
  'removeDefender',
  'removeAttacker',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBattleStage(value: unknown): value is BattleStage {
  return typeof value === 'string' && BATTLE_STAGES.has(value)
}

export function isFieldHospitalPendingEvent(
  pending: unknown,
): pending is FieldHospitalPendingEvent {
  if (!isRecord(pending) || pending.type !== 'fieldHospital') {
    return false
  }
  return typeof pending.victim === 'number'
}

export function isChooseKeepPendingEvent(
  pending: unknown,
): pending is ChooseKeepPendingEvent {
  if (!isRecord(pending) || pending.type !== 'chooseKeep') {
    return false
  }
  return typeof pending.seat === 'number'
}

export function isPlaceStartingBuildingPendingEvent(
  pending: unknown,
): pending is PlaceStartingBuildingPendingEvent {
  if (!isRecord(pending) || pending.type !== 'placeStartingBuilding') {
    return false
  }
  return typeof pending.seat === 'number' && typeof pending.building === 'string'
}

export function isChooseLeaderPendingEvent(
  pending: unknown,
): pending is ChooseLeaderPendingEvent {
  if (!isRecord(pending) || pending.type !== 'chooseLeader') {
    return false
  }
  return typeof pending.seat === 'number'
}

export function isChooseCharacterPendingEvent(
  pending: unknown,
): pending is ChooseCharacterPendingEvent {
  if (!isRecord(pending) || pending.type !== 'chooseCharacter') {
    return false
  }
  return typeof pending.seat === 'number'
}

export function isChooseForestPendingEvent(
  pending: unknown,
): pending is ChooseForestPendingEvent {
  if (!isRecord(pending) || pending.type !== 'chooseForest') {
    return false
  }
  return typeof pending.seat === 'number'
}

export function isBattlePendingEvent(
  pending: unknown,
): pending is BattlePendingEvent {
  if (!isRecord(pending) || pending.type !== 'battle') {
    return false
  }
  if (!isBattleStage(pending.stage)) {
    return false
  }
  if (typeof pending.attacker !== 'number' || typeof pending.defender !== 'number') {
    return false
  }
  return true
}

function readEffectsUsed(
  value: unknown,
): Partial<Record<'attacker' | 'defender', boolean>> | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const used: Partial<Record<'attacker' | 'defender', boolean>> = {}
  if (typeof value.attacker === 'boolean') {
    used.attacker = value.attacker
  }
  if (typeof value.defender === 'boolean') {
    used.defender = value.defender
  }
  return used
}

export function parseKnownPendingEvent(
  pending: unknown,
): KnownPendingEvent | null {
  if (isFieldHospitalPendingEvent(pending)) {
    return pending
  }
  if (isBattlePendingEvent(pending)) {
    const effectsOrderRaw = Reflect.get(pending, 'effectsOrder')
    const normalizedOrder =
      Array.isArray(effectsOrderRaw) &&
      effectsOrderRaw.every((seat) => typeof seat === 'number')
        ? effectsOrderRaw
        : undefined
    const effectsUsed = readEffectsUsed(Reflect.get(pending, 'effectsUsed'))
    return {
      type: 'battle',
      stage: pending.stage,
      attacker: pending.attacker,
      defender: pending.defender,
      ...(normalizedOrder !== undefined ? { effectsOrder: normalizedOrder } : {}),
      ...(effectsUsed !== undefined ? { effectsUsed } : {}),
    }
  }
  if (isChooseKeepPendingEvent(pending)) {
    return pending
  }
  if (isPlaceStartingBuildingPendingEvent(pending)) {
    return pending
  }
  if (isChooseLeaderPendingEvent(pending)) {
    return pending
  }
  if (isChooseCharacterPendingEvent(pending)) {
    return pending
  }
  if (isChooseForestPendingEvent(pending)) {
    return pending
  }
  return null
}
