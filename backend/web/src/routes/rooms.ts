import type { PlayerState } from '@root/lib'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { requirePlayerId } from '#lobby/onlineRooms.js'
import { HttpError } from '#middleware/errors.js'
import { expelSeat } from '#routes/lobbyPlayer.js'
import { closeOnlineRoom, publishGameChange } from '#routes/roomAccess.js'
import { errorResponses } from '#schemas/common.js'
import { EnterRoomResponseSchema, RoomCodeParamsSchema } from '#schemas/game.js'
import type { GameRoom } from '#store/GameStore.js'
import { roomRegistry } from '#store/roomRegistry.js'
import { ONLINE_HOST_SEAT, PLAYER_ID_HEADER } from '#view/actionSeatGuard.js'

const LOBBY_STATUS = 'waiting'
const FINISHED_STATUS = 'finished'

export const roomRoutes = new OpenAPIHono()

/** Nobody sat in the creator's lobby yet: nobody is left to own it once they go. */
function isCreatorOfEmptyLobby(room: GameRoom, playerId: string): boolean {
  return (
    room.creatorPlayerId === playerId &&
    room.game !== null &&
    room.game.state.status === LOBBY_STATUS &&
    room.game.state.players.length === 0
  )
}

const enterRoomRoute = createRoute({
  method: 'post',
  path: '/rooms/{roomCode}/enter',
  tags: ['game'],
  summary: 'Enter an online room by its code',
  description:
    'The caller (X-Player-Id) watches the room from now on: every /game call and the WS reach it. Pick a faction with POST /game/join. 409 ALREADY_IN_GAME while the caller is in another unfinished game.',
  request: { params: RoomCodeParamsSchema },
  responses: {
    200: {
      description: 'In the room',
      content: { 'application/json': { schema: EnterRoomResponseSchema } },
    },
    ...errorResponses,
  },
})

roomRoutes.openapi(enterRoomRoute, (context) => {
  const playerId: string = requirePlayerId(context.req.header(PLAYER_ID_HEADER))
  const roomCode: string = context.req.valid('param').roomCode.toUpperCase()
  const room: GameRoom | null = roomRegistry.findRoom(roomCode)
  if (room === null) {
    throw new HttpError(404, 'ROOM_NOT_FOUND', { roomCode })
  }
  if (roomRegistry.roomOfPlayer(playerId) !== room) {
    roomRegistry.requireNoActiveRoom(playerId)
    roomRegistry.addMember(room, playerId)
  }
  return context.json({ roomCode, mode: room.mode }, 200)
})

const leaveRoomRoute = createRoute({
  method: 'post',
  path: '/leave',
  tags: ['game'],
  summary: 'Leave the online room',
  description:
    'A watcher or a guest of a lobby leaves (their seat is freed). The host ends the room with DELETE /game instead; the creator leaving a lobby nobody sat in ends it too. Nobody leaves a game in progress.',
  responses: {
    204: { description: 'Left (or was in no room)' },
    ...errorResponses,
  },
})

roomRoutes.openapi(leaveRoomRoute, (context) => {
  const playerId: string = requirePlayerId(context.req.header(PLAYER_ID_HEADER))
  const room: GameRoom | null = roomRegistry.roomOfPlayer(playerId)
  const game = room?.game ?? null
  const seated: PlayerState | undefined = game?.state.players.find(
    (player: PlayerState): boolean => player.playerId === playerId,
  )
  if (room !== null && isCreatorOfEmptyLobby(room, playerId)) {
    closeOnlineRoom(room)
    return context.body(null, 204)
  }
  if (room === null || game === null || seated === undefined) {
    roomRegistry.removeMember(playerId)
    return context.body(null, 204)
  }
  const status = game.state.status
  if (status !== LOBBY_STATUS && status !== FINISHED_STATUS) {
    throw new HttpError(409, 'GAME_IN_PROGRESS', 'nobody leaves a game in progress')
  }
  if (status === LOBBY_STATUS) {
    if (seated.seat === ONLINE_HOST_SEAT) {
      throw new HttpError(409, 'HOST_MUST_END', 'the host ends the room with DELETE /game')
    }
    expelSeat(game, seated.seat)
    publishGameChange(room)
  }
  roomRegistry.removeMember(playerId)
  return context.body(null, 204)
})
