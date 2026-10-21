import {
  botPlayerIdFor,
  isBotFaction,
  type Action,
  type Game,
  type PlayerState,
  type Seat,
} from '@root/lib'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { logGameEvent } from '#debug/logGame.js'
import { requireNoTwinClash } from '#lobby/cooperativeLobby.js'
import { HttpError, noGame } from '#middleware/errors.js'
import { publishGameChange } from '#routes/game.js'
import { errorResponses } from '#schemas/common.js'
import {
  AddBotBodySchema,
  BotFactionParamsSchema,
  LobbySeatParamsSchema,
  SetBotSettingsBodySchema,
  SetPlayModeBodySchema,
} from '#schemas/game.js'
import { store, type AiPlayerSeat } from '#store/GameStore.js'
import {
  ONLINE_HOST_SEAT,
  PLAYER_ID_HEADER,
  seatForPlayerId,
} from '#view/actionSeatGuard.js'
import { hasOnlyTraitsOf, isSeat } from '#typeGuards.js'

const LOBBY_STATUS = 'waiting'

export const lobbyPlayerRoutes = new OpenAPIHono()

function requireGame(): Game {
  if (store.game === null) noGame()
  return store.game
}

/** Online mode: the host decides who sits at the table. Hotseat: anyone. */
function requireHostInOnlineGame(
  game: Game,
  playerId: string | undefined,
  hostOnlyDeed: string,
): void {
  if (store.mode !== 'online') {
    return
  }
  const isHost =
    playerId !== undefined &&
    seatForPlayerId(game.state, playerId) === ONLINE_HOST_SEAT
  if (!isHost) {
    throw new HttpError(403, 'NOT_HOST', `only the host may ${hostOnlyDeed}`)
  }
}

/** Play mode and bots are set before the game starts, in an open lobby. */
function requireOpenLobby(game: Game): void {
  if (game.state.status !== LOBBY_STATUS) {
    throw new HttpError(409, 'GAME_STARTED', 'the table is set in the lobby')
  }
  if (game.state.openLobby !== true) {
    throw new HttpError(409, 'NOT_OPEN_LOBBY', 'the factions were set when the game was created')
  }
}

function expelSeat(game: Game, seat: Seat): void {
  const expelAction: Action = { type: 'expel', seat }
  const result = game.apply(expelAction)
  logGameEvent('EXPEL', result.state, expelAction)
}

/** Expel every matching player, last seat first, so seats left to expel do not move. */
function expelPlayers(game: Game, isExpelled: (player: PlayerState) => boolean): void {
  const seats: Seat[] = game.state.players
    .filter(isExpelled)
    .map((player: PlayerState): Seat => player.seat)
    .sort((left: Seat, right: Seat): number => right - left)
  for (const seat of seats) expelSeat(game, seat)
}

const expelPlayerRoute = createRoute({
  method: 'delete',
  path: '/players/{seat}',
  tags: ['game'],
  summary: 'Expel a player from the open lobby',
  description:
    'Frees the seat of a human, AI player or bot; later seats move down one. Host only in online mode. The host seat (0) cannot be expelled.',
  request: { params: LobbySeatParamsSchema },
  responses: {
    204: { description: 'Player expelled' },
    ...errorResponses,
  },
})

lobbyPlayerRoutes.openapi(expelPlayerRoute, (context) => {
  const game = requireGame()
  requireHostInOnlineGame(game, context.req.header(PLAYER_ID_HEADER), 'expel a player')
  const seat: number = context.req.valid('param').seat
  if (!isSeat(seat)) {
    throw new HttpError(400, 'BAD_SEAT', { seat })
  }
  const expelled = game.state.players.find(
    (player: PlayerState): boolean => player.seat === seat,
  )
  expelSeat(game, seat)
  store.aiPlayers = store.aiPlayers.filter(
    (aiSeat: AiPlayerSeat): boolean => aiSeat.playerId !== expelled?.playerId,
  )
  publishGameChange()
  return context.body(null, 204)
})

const setPlayModeRoute = createRoute({
  method: 'put',
  path: '/play-mode',
  tags: ['game'],
  summary: 'Switch the open lobby between free-for-all and co-op vs bots',
  description:
    'Co-op (Rootbotics 3.5.1): AI players leave the table; bots are seated with `POST /game/bots`. Free-for-all: the bots leave the table, their settings stay. Host only in online mode.',
  request: {
    body: {
      content: { 'application/json': { schema: SetPlayModeBodySchema } },
      required: true,
    },
  },
  responses: {
    204: { description: 'Play mode set' },
    ...errorResponses,
  },
})

lobbyPlayerRoutes.openapi(setPlayModeRoute, (context) => {
  const game = requireGame()
  requireOpenLobby(game)
  requireHostInOnlineGame(game, context.req.header(PLAYER_ID_HEADER), 'change the play mode')
  const isCooperative = context.req.valid('json').playMode === 'cooperative'
  if (isCooperative) {
    const aiPlayerIds: string[] = store.aiPlayers.map(
      (aiSeat: AiPlayerSeat): string => aiSeat.playerId,
    )
    expelPlayers(game, (player: PlayerState): boolean => aiPlayerIds.includes(player.playerId))
    store.aiPlayers = []
  } else {
    expelPlayers(game, (player: PlayerState): boolean => isBotFaction(player.faction))
  }
  game.setCooperative(isCooperative)
  publishGameChange()
  return context.body(null, 204)
})

const addBotRoute = createRoute({
  method: 'post',
  path: '/bots',
  tags: ['game'],
  summary: 'Seat a Rootbotics bot in the co-op lobby',
  description:
    'The bot takes the next seat and plays its own turns. Never next to the faction it replaces (Rootbotics 3.2). Host only in online mode.',
  request: {
    body: {
      content: { 'application/json': { schema: AddBotBodySchema } },
      required: true,
    },
  },
  responses: {
    204: { description: 'Bot seated' },
    ...errorResponses,
  },
})

lobbyPlayerRoutes.openapi(addBotRoute, (context) => {
  const game = requireGame()
  requireOpenLobby(game)
  requireHostInOnlineGame(game, context.req.header(PLAYER_ID_HEADER), 'add a bot')
  if (game.state.cooperative !== true) {
    throw new HttpError(400, 'NOT_COOPERATIVE', 'bots join co-op games only')
  }
  const { faction, settings } = context.req.valid('json')
  if (settings !== undefined && !hasOnlyTraitsOf(faction, settings.traits)) {
    throw new HttpError(400, 'BAD_BOT_SETTINGS', settings)
  }
  if (game.state.players.some((player: PlayerState): boolean => player.faction === faction)) {
    throw new HttpError(409, 'BOT_SEATED', { faction })
  }
  const playerId = botPlayerIdFor(faction)
  requireNoTwinClash(game.state, { playerId, faction })
  const joinAction: Action = { type: 'join', playerId, faction }
  const result = game.apply(joinAction)
  if (settings !== undefined) game.setBotSettings(faction, settings)
  logGameEvent('JOIN', result.state, joinAction)
  publishGameChange()
  return context.body(null, 204)
})

const setBotSettingsRoute = createRoute({
  method: 'put',
  path: '/bots/{faction}',
  tags: ['game'],
  summary: 'Set the difficulty and traits of a bot (lobby only)',
  description: 'Rootbotics 3.3. Host only in online mode.',
  request: {
    params: BotFactionParamsSchema,
    body: {
      content: { 'application/json': { schema: SetBotSettingsBodySchema } },
      required: true,
    },
  },
  responses: {
    204: { description: 'Settings set' },
    ...errorResponses,
  },
})

lobbyPlayerRoutes.openapi(setBotSettingsRoute, (context) => {
  const game = requireGame()
  requireOpenLobby(game)
  requireHostInOnlineGame(game, context.req.header(PLAYER_ID_HEADER), 'tune a bot')
  const faction = context.req.valid('param').faction
  const settings = context.req.valid('json').settings
  if (!hasOnlyTraitsOf(faction, settings.traits)) {
    throw new HttpError(400, 'BAD_BOT_SETTINGS', settings)
  }
  game.setBotSettings(faction, settings)
  publishGameChange()
  return context.body(null, 204)
})
