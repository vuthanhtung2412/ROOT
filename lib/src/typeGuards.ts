import type {
  BattleEvent,
  ChooseCharacterEvent,
  ChooseForestEvent,
  ChooseKeepEvent,
  ChooseLeaderEvent,
  Event,
  FieldHospitalEvent,
  OutrageEvent,
  VagabondDamageEvent,
  PlaceStartingBuildingEvent,
} from '#events/types.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { VAGABOND_CHARACTERS } from '#state/boards.js'
import type {
  AllianceBoard,
  EyrieBoard,
  FactionBoard,
  MarquiseBoard,
  VagabondBoard,
  VagabondCharacter,
} from '#state/boards.js'

const FALL_CLEARING_COUNT = 12
const FALL_FOREST_COUNT = 11

export function isClearingId(value: number): value is ClearingId {
  return Number.isInteger(value) && value >= 0 && value < FALL_CLEARING_COUNT
}

export function isForestIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < FALL_FOREST_COUNT
}

export function isSeat(value: number): value is Seat {
  return value === 0 || value === 1 || value === 2 || value === 3
}

export function requireSeat(value: number): Seat {
  if (!isSeat(value)) {
    throw new Error(`invalid seat: ${value}`)
  }
  return value
}

export function isBattleEvent(event: Event): event is BattleEvent {
  return event.type === 'battle'
}

export function isFieldHospitalEvent(event: Event): event is FieldHospitalEvent {
  return event.type === 'fieldHospital'
}

export function isChooseKeepEvent(event: Event): event is ChooseKeepEvent {
  return event.type === 'chooseKeep'
}

export function isPlaceStartingBuildingEvent(
  event: Event,
): event is PlaceStartingBuildingEvent {
  return event.type === 'placeStartingBuilding'
}

export function isChooseLeaderEvent(event: Event): event is ChooseLeaderEvent {
  return event.type === 'chooseLeader'
}

export function isChooseCharacterEvent(
  event: Event,
): event is ChooseCharacterEvent {
  return event.type === 'chooseCharacter'
}

export function isVagabondCharacter(value: string): value is VagabondCharacter {
  return VAGABOND_CHARACTERS.some((character) => character === value)
}

export function isChooseForestEvent(event: Event): event is ChooseForestEvent {
  return event.type === 'chooseForest'
}

export function isOutrageEvent(event: Event): event is OutrageEvent {
  return event.type === 'outrage'
}

export function isVagabondDamageEvent(event: Event): event is VagabondDamageEvent {
  return event.type === 'vagabondDamage'
}

export function isMarquiseBoard(board: FactionBoard): board is MarquiseBoard {
  return board.kind === 'marquise'
}

export function isEyrieBoard(board: FactionBoard): board is EyrieBoard {
  return board.kind === 'eyrie'
}

export function isAllianceBoard(board: FactionBoard): board is AllianceBoard {
  return board.kind === 'alliance'
}

export function isVagabondBoard(board: FactionBoard): board is VagabondBoard {
  return board.kind === 'vagabond'
}
