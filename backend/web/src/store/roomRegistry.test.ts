import { describe, expect, it } from 'vitest'
import { HttpError } from '#middleware/errors.js'
import type { GameRoom } from '#store/GameStore.js'
import {
  generateRoomCode,
  MAXIMUM_ONLINE_ROOM_COUNT,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  RoomRegistry,
} from '#store/roomRegistry.js'
import { createStartedTwoPlayerGame } from '#test/gameStateFixtures.js'

const PLAYER_ID = 'player-secret'
const FIRST_CODE = 'AAAAAA'
const SECOND_CODE = 'BBBBBB'

/** Hands out the given codes in order, then numbered ones. */
function scriptedCodes(...codes: readonly string[]): () => string {
  let index = 0
  return (): string => {
    const code = codes[index] ?? `CODE${String(index)}`
    index += 1
    return code
  }
}

function errorCodeOf(action: () => void): string {
  try {
    action()
  } catch (error: unknown) {
    if (error instanceof HttpError) return error.code
    throw error
  }
  return ''
}

describe('generateRoomCode', () => {
  it('makes codes from the readable alphabet only', () => {
    const code = generateRoomCode()

    expect(code).toHaveLength(ROOM_CODE_LENGTH)
    expect([...code].every((letter: string): boolean => ROOM_CODE_ALPHABET.includes(letter))).toBe(true)
  })
})

describe('RoomRegistry', () => {
  it('never gives two rooms the same code', () => {
    const registry = new RoomRegistry(scriptedCodes(FIRST_CODE, FIRST_CODE, SECOND_CODE))

    const first: GameRoom = registry.createRoom(PLAYER_ID)
    const second: GameRoom = registry.createRoom(PLAYER_ID)

    expect(first.roomCode).toBe(FIRST_CODE)
    expect(second.roomCode).toBe(SECOND_CODE)
    expect(registry.findRoom(SECOND_CODE)).toBe(second)
  })

  it('refuses a room past the limit', () => {
    const registry = new RoomRegistry(scriptedCodes())
    for (let index = 0; index < MAXIMUM_ONLINE_ROOM_COUNT; index += 1) registry.createRoom(PLAYER_ID)

    expect(errorCodeOf((): void => { registry.createRoom(PLAYER_ID) })).toBe('ROOM_LIMIT')
  })

  it('a player belongs to one room: joining another moves them', () => {
    const registry = new RoomRegistry(scriptedCodes(FIRST_CODE, SECOND_CODE))
    const first = registry.createRoom(PLAYER_ID)
    const second = registry.createRoom(PLAYER_ID)

    registry.addMember(first, PLAYER_ID)
    registry.addMember(second, PLAYER_ID)

    expect(registry.roomOfPlayer(PLAYER_ID)).toBe(second)
    expect(registry.membersOf(first)).toEqual([])
  })

  it('an unfinished game blocks another; a finished or empty one does not', () => {
    const registry = new RoomRegistry(scriptedCodes(FIRST_CODE))
    const room = registry.createRoom(PLAYER_ID)
    registry.addMember(room, PLAYER_ID)

    expect(errorCodeOf((): void => { registry.requireNoActiveRoom(PLAYER_ID) })).toBe('')

    const game = createStartedTwoPlayerGame()
    room.game = game
    expect(errorCodeOf((): void => { registry.requireNoActiveRoom(PLAYER_ID) })).toBe('ALREADY_IN_GAME')

    game.state.status = 'finished'
    expect(errorCodeOf((): void => { registry.requireNoActiveRoom(PLAYER_ID) })).toBe('')
  })

  it('removing a room frees its members', () => {
    const registry = new RoomRegistry(scriptedCodes(FIRST_CODE))
    const room = registry.createRoom(PLAYER_ID)
    registry.addMember(room, PLAYER_ID)

    registry.removeRoom(room)

    expect(registry.findRoom(FIRST_CODE)).toBeNull()
    expect(registry.roomOfPlayer(PLAYER_ID)).toBeNull()
  })
})
