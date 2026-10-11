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
  /** Rule: G.1.21 Replace — the warriors were replaced, not just removed. */
  replaced?: true
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

/** Rule: Vagabond > Setup 1 — choose a character. */
export type ChooseCharacterEvent = {
  type: 'chooseCharacter'
  seat: Seat
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

/** Rule: 10.3.2 — Lizard Cult chooses its starting corner clearing. */
export type ChooseCultCornerEvent = {
  type: 'chooseCultCorner'
  seat: Seat
}

/** Rule: 10.3.3 — Lizard Cult places the outcast marker on a suit. */
export type ChooseOutcastEvent = {
  type: 'chooseOutcast'
  seat: Seat
}

/** Rule: 11.3.2 — Riverfolk place starting warriors, one clearing at a time. */
export type PlaceRiverfolkWarriorEvent = {
  type: 'placeRiverfolkWarrior'
  seat: Seat
  /** Warriors still to place, this one included. */
  remaining: number
}

/** Rule: 11.3.5 — Riverfolk set the starting cost of all three services. */
export type SetStartingCostsEvent = {
  type: 'setStartingCosts'
  seat: Seat
}

/** Rule: 11.2.6 — at the start of their Birdsong, a player may buy services. */
export type BuyServicesEvent = {
  type: 'buyServices'
  buyer: Seat
  /** Services already bought this turn. Rule: 11.2.6.II. */
  bought: number
}

export type Event =
  | BuyServicesEvent
  | ChooseCultCornerEvent
  | ChooseOutcastEvent
  | PlaceRiverfolkWarriorEvent
  | SetStartingCostsEvent
  | BattleEvent
  | FieldHospitalEvent
  | ChooseKeepEvent
  | PlaceStartingBuildingEvent
  | ChooseLeaderEvent
  | ChooseCharacterEvent
  | ChooseForestEvent
  | OutrageEvent
  | VagabondDamageEvent
