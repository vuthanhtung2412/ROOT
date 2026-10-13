import {
  createAiPlayerApi,
  type AiPlayerApi,
} from '@root/web-client/ai-player-api'
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

/** `--player-id <id>`: act as that seat only, with the other hands hidden. */
export const PLAYER_ID_FLAG = '--player-id'

function readPlayerIdFlag(): string | null {
  const flagIndex = process.argv.indexOf(PLAYER_ID_FLAG)
  return flagIndex < 0 ? null : (process.argv[flagIndex + 1] ?? null)
}

const playerId: string | null = readPlayerIdFlag()

export const api: GameApi = createGameApi(
  playerId === null
    ? {}
    : { playerId: (): string => playerId, playerView: true },
)

export const aiPlayerApi: AiPlayerApi = createAiPlayerApi()
