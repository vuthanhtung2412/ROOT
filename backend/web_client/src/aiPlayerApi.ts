import type { components } from '@root/web-client'
import {
  createClient,
  parseFactionIds,
  requireData,
  type AiPlayer,
  type CreateGameApiOptions,
} from '@root/web-client/game-api'
import { readServerSentEvents } from '@root/web-client/server-sent-events'

export type { AiPlayer } from '@root/web-client/game-api'

/** Models an AI player may use, as `<provider>:<modelId>`. */
export type AiModels = components['schemas']['AiModelsResponse']

/** One thing an AI player did: message, reply, tool call, tool result, failure. */
export type AiPlayerActivity = components['schemas']['AiPlayerActivity']

/** Narrows the parsed data of a stream event. */
function isAiPlayerActivity(value: unknown): value is AiPlayerActivity {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'sequence') === 'number' &&
    typeof Reflect.get(value, 'at') === 'string' &&
    typeof Reflect.get(value, 'seat') === 'number' &&
    typeof Reflect.get(value, 'model') === 'string' &&
    typeof Reflect.get(value, 'kind') === 'string' &&
    typeof Reflect.get(value, 'text') === 'string' &&
    typeof Reflect.get(value, 'isError') === 'boolean'
  )
}

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
  /**
   * What the AI players do: the latest activities, then live ones, until the
   * server closes the stream. Rejects when the server cannot be reached.
   */
  streamAiPlayerActivity: (
    onActivity: (activity: AiPlayerActivity) => void,
  ) => Promise<void>
  /** Look up the Law of Root by rule number or keywords. */
  rules: (query: string) => Promise<string>
  /**
   * Run a read-only player tool (card, clearing, score, workshops, sympathy,
   * decree, preview) as the seat of the client's `playerId`.
   */
  playerTool: (tool: string, input: PlayerToolInput) => Promise<PlayerToolResult>
}

/** Input of a player tool: the JSON object the tool takes. */
export type PlayerToolInput = components['schemas']['JsonObject']

/** Answer of a player tool: JSON text, or why it could not answer. */
export type PlayerToolResult = components['schemas']['PlayerToolResult']

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

    async streamAiPlayerActivity(
      onActivity: (activity: AiPlayerActivity) => void,
    ): Promise<void> {
      const result = await client.GET('/game/ai-players/stream', {
        parseAs: 'stream',
      })
      const body = requireData(result)
      if (body === null) {
        return
      }
      await readServerSentEvents(body, (data: string): void => {
        const activity: unknown = JSON.parse(data)
        if (isAiPlayerActivity(activity)) {
          onActivity(activity)
        }
      })
    },

    async rules(query: string): Promise<string> {
      return requireData(
        await client.GET('/game/rules', {
          params: { query: { query } },
          parseAs: 'text',
        }),
      )
    },

    async playerTool(
      tool: string,
      input: PlayerToolInput,
    ): Promise<PlayerToolResult> {
      return requireData(
        await client.POST('/game/player-tools/{tool}', {
          params: { path: { tool } },
          body: input,
        }),
      )
    },
  }
}
