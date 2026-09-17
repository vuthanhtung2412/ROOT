import type { ClearingId } from '../map/types.js'
import type { Seat } from '../pieces/types.js'

export type BattleStage =
  | 'ambush'
  | 'foil'
  | 'roll'
  | 'effectsOrder'
  | 'effects'
  | 'removeDefender'
  | 'removeAttacker'

export type BattleEvent = {
  type: 'battle'
  clearing: ClearingId
  attacker: Seat
  defender: Seat
  stage: BattleStage
  effectsOrder?: Seat[]
  rolls?: [number, number]
  hits: { attacker: number; defender: number }
  /** Defender ambush card played (before foil). */
  ambushCardId?: string
  /** Attacker/Defender opted into optional battle effects. */
  effectsUsed?: Partial<Record<'attacker' | 'defender', boolean>>
}

export type FieldHospitalEvent = {
  type: 'fieldHospital'
  victim: Seat
  clearing: ClearingId
  count: number
}

export type OutrageEvent = {
  type: 'outrage'
  offender: Seat
  clearing: ClearingId
}

export type VagabondDamageEvent = {
  type: 'vagabondDamage'
  count: number
}

export type Event =
  | BattleEvent
  | FieldHospitalEvent
  | OutrageEvent
  | VagabondDamageEvent
