/**
 * A seat number medallion with a remove action shows ✕ on hover or focus.
 * Touch has no hover: the first tap shows ✕ ("armed"), the second removes.
 */
export type SeatMedallionTapOutcome = 'arm' | 'remove'

const TOUCH_POINTER_TYPE = 'touch'

export type SeatMedallionTap = {
  /** `PointerEvent.pointerType` of the press: mouse, pen or touch. */
  pointerType: string
  /** ✕ already shown by an earlier tap. */
  isArmed: boolean
}

export function seatMedallionTapOutcome(tap: SeatMedallionTap): SeatMedallionTapOutcome {
  if (tap.pointerType !== TOUCH_POINTER_TYPE) return 'remove'
  return tap.isArmed ? 'remove' : 'arm'
}
