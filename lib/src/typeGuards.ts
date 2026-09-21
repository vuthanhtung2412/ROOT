import type {
  BattleEvent,
  ChooseKeepEvent,
  ChooseLeaderEvent,
  Event,
  FieldHospitalEvent,
} from './events/types.js'
import type { ClearingId } from './map/types.js'
import type { Seat } from './pieces/types.js'
import type { EyrieBoard, FactionBoard, MarquiseBoard } from './state/boards.js'

const FALL_CLEARING_COUNT = 12

export function isClearingId(value: number): value is ClearingId {
  return Number.isInteger(value) && value >= 0 && value < FALL_CLEARING_COUNT
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

export function isChooseLeaderEvent(event: Event): event is ChooseLeaderEvent {
  return event.type === 'chooseLeader'
}

export function isMarquiseBoard(board: FactionBoard): board is MarquiseBoard {
  return board.kind === 'marquise'
}

export function isEyrieBoard(board: FactionBoard): board is EyrieBoard {
  return board.kind === 'eyrie'
}
