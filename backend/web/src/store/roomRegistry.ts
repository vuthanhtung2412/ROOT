import { randomInt } from 'node:crypto'
import { HttpError } from '#middleware/errors.js'
import { createGameRoom, type GameRoom } from '#store/GameStore.js'

/** No 0/O, 1/I/L: codes are read aloud and typed by hand. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6
/** Every room may run LLM seats and bots: keep the server's load bounded. */
export const MAXIMUM_ONLINE_ROOM_COUNT = 20

const FINISHED_STATUS = 'finished'

export function generateRoomCode(): string {
  let code = ''
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]
  }
  return code
}

/** A room counts as the player's game until its game is over. */
export function isActiveRoom(room: GameRoom): boolean {
  return room.game !== null && room.game.state.status !== FINISHED_STATUS
}

/**
 * The online rooms of the server and who is in each. A player id belongs to
 * one room at most: seated players and unseated watchers alike.
 */
export class RoomRegistry {
  private readonly roomsByCode = new Map<string, GameRoom>()
  private readonly roomCodeByPlayerId = new Map<string, string>()

  constructor(private readonly createRoomCode: () => string = generateRoomCode) {}

  /** A new empty room with a code no other room uses. */
  createRoom(): GameRoom {
    if (this.roomsByCode.size >= MAXIMUM_ONLINE_ROOM_COUNT) {
      throw new HttpError(503, 'ROOM_LIMIT', { maximum: MAXIMUM_ONLINE_ROOM_COUNT })
    }
    let roomCode = this.createRoomCode()
    while (this.roomsByCode.has(roomCode)) {
      roomCode = this.createRoomCode()
    }
    const room: GameRoom = createGameRoom(roomCode)
    this.roomsByCode.set(roomCode, room)
    return room
  }

  /** A room saved before a restart comes back under its own code. */
  restoreRoom(room: GameRoom): void {
    if (room.roomCode === null) {
      return
    }
    this.roomsByCode.set(room.roomCode, room)
  }

  findRoom(roomCode: string): GameRoom | null {
    return this.roomsByCode.get(roomCode) ?? null
  }

  roomOfPlayer(playerId: string): GameRoom | null {
    const roomCode = this.roomCodeByPlayerId.get(playerId)
    return roomCode === undefined ? null : this.findRoom(roomCode)
  }

  /** Rule: one active game per player. 409 names the room to resume. */
  requireNoActiveRoom(playerId: string): void {
    const room = this.roomOfPlayer(playerId)
    if (room !== null && isActiveRoom(room)) {
      throw new HttpError(409, 'ALREADY_IN_GAME', { roomCode: room.roomCode })
    }
  }

  /** The player now belongs to `room`, and to no other. */
  addMember(room: GameRoom, playerId: string): void {
    if (room.roomCode === null) {
      return
    }
    this.roomCodeByPlayerId.set(playerId, room.roomCode)
  }

  removeMember(playerId: string): void {
    this.roomCodeByPlayerId.delete(playerId)
  }

  /** Drop the room and free every player in it. */
  removeRoom(room: GameRoom): void {
    if (room.roomCode === null) {
      return
    }
    this.roomsByCode.delete(room.roomCode)
    for (const [playerId, roomCode] of [...this.roomCodeByPlayerId]) {
      if (roomCode === room.roomCode) {
        this.roomCodeByPlayerId.delete(playerId)
      }
    }
  }

  /** Player ids in the room, seated or watching. */
  membersOf(room: GameRoom): string[] {
    return [...this.roomCodeByPlayerId]
      .filter(([, roomCode]: [string, string]): boolean => roomCode === room.roomCode)
      .map(([playerId]: [string, string]): string => playerId)
  }

  rooms(): GameRoom[] {
    return [...this.roomsByCode.values()]
  }
}

export const roomRegistry = new RoomRegistry()
