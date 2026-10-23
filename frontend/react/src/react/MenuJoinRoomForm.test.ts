import { describe, expect, it } from 'vitest'
import {
  isCompleteRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from '#react/MenuJoinRoomForm.tsx'

describe('room code typing', () => {
  it('drops spaces, upper-cases and stops at the code length', () => {
    expect(normalizeRoomCode(' ab c2 34xyz')).toBe('ABC234')
  })

  it('is complete only at the full length', () => {
    expect(isCompleteRoomCode('ABC23')).toBe(false)
    expect(isCompleteRoomCode('ABC234')).toBe(true)
    expect('ABC234').toHaveLength(ROOM_CODE_LENGTH)
  })
})
