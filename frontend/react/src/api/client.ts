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

export type FrontendApiClient = GameApi

export type CreateFrontendApiOptions = {
  baseUrl?: string
  client?: RootWebClient
}

export function createFrontendApi(
  options: CreateFrontendApiOptions = {},
): FrontendApiClient {
  return createGameApi({
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(options.client === undefined ? {} : { client: options.client }),
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
