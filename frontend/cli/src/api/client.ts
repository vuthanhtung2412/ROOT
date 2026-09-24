import {
  createGameApi,
  type GameApi,
} from '@root/web-client/game-api'

export {
  ApiError,
  type ActionResult,
  type ActionSpec,
  type GameState,
} from '@root/web-client/game-api'

export const api: GameApi = createGameApi()
