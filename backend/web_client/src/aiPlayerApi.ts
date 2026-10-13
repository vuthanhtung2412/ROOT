import type { components } from '@root/web-client'
import {
  createClient,
  parseFactionIds,
  requireData,
  type AiPlayer,
  type CreateGameApiOptions,
} from '@root/web-client/game-api'

export type { AiPlayer } from '@root/web-client/game-api'

/** Models an AI player may use, as `<provider>:<modelId>`. */
export type AiModels = components['schemas']['AiModelsResponse']

export type AddAiPlayerInput = {
  /** Open lobby: the faction the AI player takes. */
  faction?: string
  /** Omitted = the server's default model. */
  model?: string
}

export type AiPlayerApi = {
  aiModels: () => Promise<AiModels>
  /** Lobby only. Resolves to every AI seat of the game. */
  addAiPlayer: (input?: AddAiPlayerInput) => Promise<AiPlayer[]>
  /** Lobby only. */
  setAiPlayerModel: (seat: number, model: string) => Promise<AiPlayer[]>
  /** Drop the AI player's session and start a fresh one (stuck or thinking). */
  restartAiPlayer: (seat: number) => Promise<AiPlayer[]>
  /** Look up the Law of Root by rule number or keywords. */
  rules: (query: string) => Promise<string>
}

export function createAiPlayerApi(
  options: CreateGameApiOptions = {},
): AiPlayerApi {
  const client = createClient(options)

  return {
    async aiModels(): Promise<AiModels> {
      return requireData(await client.GET('/game/ai-models'))
    },

    async addAiPlayer(input: AddAiPlayerInput = {}): Promise<AiPlayer[]> {
      const result = await client.POST('/game/ai-players', {
        body: {
          ...(input.faction === undefined
            ? {}
            : { faction: parseFactionIds([input.faction])[0]! }),
          ...(input.model === undefined ? {} : { model: input.model }),
        },
      })
      return requireData(result).aiPlayers
    },

    async setAiPlayerModel(seat: number, model: string): Promise<AiPlayer[]> {
      const result = await client.PATCH('/game/ai-players/{seat}', {
        params: { path: { seat } },
        body: { model },
      })
      return requireData(result).aiPlayers
    },

    async restartAiPlayer(seat: number): Promise<AiPlayer[]> {
      const result = await client.POST('/game/ai-players/{seat}/restart', {
        params: { path: { seat } },
      })
      return requireData(result).aiPlayers
    },

    async rules(query: string): Promise<string> {
      return requireData(
        await client.GET('/game/rules', {
          params: { query: { query } },
          parseAs: 'text',
        }),
      )
    },
  }
}
