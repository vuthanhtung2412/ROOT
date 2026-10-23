import { describe, expect, it } from 'vitest'
import { createGameRoom, type GameRoom } from '#store/GameStore.js'
import { runtimeOf, type RoomRuntime } from '#store/roomRuntime.js'

const FIRST_ROOM_CODE = 'ROOMAA'
const SECOND_ROOM_CODE = 'ROOMBB'

describe('runtimeOf', () => {
  it('keeps one runtime per room', () => {
    const room: GameRoom = createGameRoom(FIRST_ROOM_CODE)

    const first: RoomRuntime = runtimeOf(room)

    expect(runtimeOf(room)).toBe(first)
  })

  it('gives every room drivers of its own', () => {
    const first: RoomRuntime = runtimeOf(createGameRoom(FIRST_ROOM_CODE))
    const second: RoomRuntime = runtimeOf(createGameRoom(SECOND_ROOM_CODE))

    expect(second.aiPlayerDriver).not.toBe(first.aiPlayerDriver)
    expect(second.botStepDriver).not.toBe(first.botStepDriver)
  })
})
