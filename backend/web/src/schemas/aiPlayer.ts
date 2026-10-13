import { z } from '@hono/zod-openapi'
import { AI_PLAYER_ACTIVITY_KINDS } from '#aiPlayer/AiPlayerActivityFeed.js'
import { FactionIdSchema } from '#schemas/common.js'
import { AI_PLAYER_STATUSES } from '#store/GameStore.js'

const MODEL_DESCRIPTION =
  'Model as <provider>:<modelId>, one of GET /game/ai-models.'

export const AiPlayerStatusSchema = z
  .enum(AI_PLAYER_STATUSES)
  .openapi('AiPlayerStatus')

export const AiPlayerSchema = z
  .object({
    seat: z.number().int().min(0).max(3),
    model: z.string().openapi({ description: MODEL_DESCRIPTION }),
    status: AiPlayerStatusSchema,
  })
  .openapi('AiPlayer')

export const AiPlayersResponseSchema = z
  .object({ aiPlayers: z.array(AiPlayerSchema) })
  .openapi('AiPlayersResponse')

export const AiModelsResponseSchema = z
  .object({
    models: z.array(z.string()).openapi({
      description:
        'Models an AI player may use: the server list, minus providers without an API key.',
    }),
    defaultModel: z.string().nullable(),
  })
  .openapi('AiModelsResponse')

export const AddAiPlayerBodySchema = z
  .object({
    faction: FactionIdSchema.optional().openapi({
      description: 'Open lobby: the faction the AI player takes.',
    }),
    model: z.string().optional().openapi({
      description: `${MODEL_DESCRIPTION} Omitted = the default model.`,
    }),
  })
  .openapi('AddAiPlayerBody')

export const SetAiPlayerModelBodySchema = z
  .object({
    model: z.string().openapi({ description: MODEL_DESCRIPTION }),
  })
  .openapi('SetAiPlayerModelBody')

export const AiPlayerSeatParamsSchema = z.object({
  seat: z.coerce.number().int().min(0).max(3).openapi({
    param: { name: 'seat', in: 'path' },
    description: 'Seat of the AI player.',
  }),
})

export const AiPlayerActivityKindSchema = z
  .enum(AI_PLAYER_ACTIVITY_KINDS)
  .openapi('AiPlayerActivityKind')

export const AiPlayerActivitySchema = z
  .object({
    sequence: z.number().int().openapi({
      description: 'Rises by one per activity since the server started.',
    }),
    at: z.string().openapi({ description: 'ISO 8601 time.' }),
    seat: z.number().int().min(0).max(3),
    model: z.string().openapi({ description: MODEL_DESCRIPTION }),
    kind: AiPlayerActivityKindSchema,
    toolName: z.string().nullable().openapi({
      description: 'Tool of a toolCall / toolResult, else null.',
    }),
    text: z.string().openapi({
      description:
        'Message to the model, its reply, tool input as JSON, tool result or failure reason.',
    }),
    isError: z.boolean().openapi({
      description: 'True for a failure and for a tool result the tool rejected.',
    }),
  })
  .openapi('AiPlayerActivity')
