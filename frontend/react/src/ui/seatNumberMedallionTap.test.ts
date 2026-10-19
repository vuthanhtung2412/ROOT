import { describe, expect, it } from 'vitest'
import { seatMedallionTapOutcome } from '#ui/seatNumberMedallionTap.ts'

describe('seat number medallion tap', () => {
  it('a mouse or pen click removes at once: hover already shows ✕', () => {
    expect(seatMedallionTapOutcome({ pointerType: 'mouse', isArmed: false })).toBe('remove')
    expect(seatMedallionTapOutcome({ pointerType: 'pen', isArmed: false })).toBe('remove')
  })

  it('keyboard (no pointer) removes: focus already shows ✕', () => {
    expect(seatMedallionTapOutcome({ pointerType: '', isArmed: false })).toBe('remove')
  })

  it('touch: the first tap shows ✕, the second removes', () => {
    expect(seatMedallionTapOutcome({ pointerType: 'touch', isArmed: false })).toBe('arm')
    expect(seatMedallionTapOutcome({ pointerType: 'touch', isArmed: true })).toBe('remove')
  })
})
