import {
  createAiPlayerApi,
  type AiPlayerApi,
} from '@root/web-client/ai-player-api'
import {
  createGameApi,
  type GameApi,
  type RootWebClient,
} from '@root/web-client/game-api'

export {
  ApiError,
  type ActionResult,
  type ActionSpec,
  type BotFactionId,
  type BotSettings,
  type BotStepDelaySeconds,
  type CreateGameInput,
  type GameState,
  type LegalActionsResponse,
  type LobbyMode,
  type PlayMode,
} from '@root/web-client/game-api'

export type {
  AddAiPlayerInput,
  AiModels,
  AiPlayer,
  AiPlayerApi,
} from '@root/web-client/ai-player-api'

const API_REQUEST_TIMEOUT_MILLISECONDS = 10_000

export type FrontendApiClient = GameApi

export type CreateFrontendApiOptions = {
  baseUrl?: string
  client?: RootWebClient
  /** Current join id, sent as a header so the server can check the seat. */
  playerId?: () => string | null
}

export function createFrontendApi(
  options: CreateFrontendApiOptions = {},
): FrontendApiClient {
  return createGameApi({
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(options.client === undefined ? {} : { client: options.client }),
    ...(options.playerId === undefined ? {} : { playerId: options.playerId }),
    requestTimeoutMilliseconds: API_REQUEST_TIMEOUT_MILLISECONDS,
  })
}

/** AI player calls (models, seating). API keys never leave the server. */
export function createFrontendAiPlayerApi(
  options: CreateFrontendApiOptions = {},
): AiPlayerApi {
  return createAiPlayerApi({
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(options.client === undefined ? {} : { client: options.client }),
    ...(options.playerId === undefined ? {} : { playerId: options.playerId }),
    requestTimeoutMilliseconds: API_REQUEST_TIMEOUT_MILLISECONDS,
  })
}

/** @deprecated Use `createFrontendApi`. */
export type PhaserApiClient = FrontendApiClient

/** @deprecated Use `CreateFrontendApiOptions`. */
export type CreatePhaserApiOptions = CreateFrontendApiOptions

/** @deprecated Use `createFrontendApi`. */
export function createPhaserApi(
  options: CreatePhaserApiOptions = {},
): PhaserApiClient {
  return createFrontendApi(options)
}
