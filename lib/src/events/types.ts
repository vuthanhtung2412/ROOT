import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'

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
  /** Rule: 9.2.9.IIc — Allied seat treated as own by Vagabond attacker. */
  alliedSeat?: Seat
  /** Rule: 9.2.9.IId — ally warriors removed as hits this battle. */
  alliedHitsTaken?: number
  /** Rule: 9.2.9.IId — items damaged as hits this battle. */
  itemHitsTaken?: number
}

export type FieldHospitalEvent = {
  type: 'fieldHospital'
  victim: Seat
  clearing: ClearingId
  count: number
}

/** Rule: Marquise > Setup 2 — choose keep corner. */
export type ChooseKeepEvent = {
  type: 'chooseKeep'
  seat: Seat
}

/** Rule: Marquise > Setup 4 — place one starting building (sawmill → workshop → recruiter). */
export type PlaceStartingBuildingEvent = {
  type: 'placeStartingBuilding'
  seat: Seat
  building: 'sawmill' | 'workshop' | 'recruiter'
}

/** Rule: Eyrie > Setup 3 / 7.7.3 Depose — choose face-up leader. */
export type ChooseLeaderEvent = {
  type: 'chooseLeader'
  seat: Seat
  reason: 'setup' | 'depose'
}

/** Rule: Vagabond > Setup 2 — place pawn in any forest. */
export type ChooseForestEvent = {
  type: 'chooseForest'
  seat: Seat
}

export type OutrageEvent = {
  type: 'outrage'
  offender: Seat
  clearing: ClearingId
}

/** Rule: 9.2.6 / 9.2.3.I — Vagabond chooses `count` undamaged items to damage. */
export type VagabondDamageEvent = {
  type: 'vagabondDamage'
  seat: Seat
  count: number
}

export type Event =
  | BattleEvent
  | FieldHospitalEvent
  | ChooseKeepEvent
  | PlaceStartingBuildingEvent
  | ChooseLeaderEvent
  | ChooseForestEvent
  | OutrageEvent
  | VagabondDamageEvent
