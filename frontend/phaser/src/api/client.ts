import {
  createGameApi,
  type GameApi,
  type RootWebClient,
} from '@root/web-client/game-api'

export {
  ApiError,
  type ActionResult,
  type ActionSpec,
  type CreateGameInput,
  type GameState,
  type LegalActionsResponse,
} from '@root/web-client/game-api'

const API_REQUEST_TIMEOUT_MILLISECONDS = 10_000

export type PhaserApiClient = GameApi

export type CreatePhaserApiOptions = {
  baseUrl?: string
  client?: RootWebClient
}

export function createPhaserApi(
  options: CreatePhaserApiOptions = {},
): PhaserApiClient {
  return createGameApi({
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(options.client === undefined ? {} : { client: options.client }),
    requestTimeoutMilliseconds: API_REQUEST_TIMEOUT_MILLISECONDS,
  })
}
