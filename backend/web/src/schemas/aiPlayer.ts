import { z } from '@hono/zod-openapi'
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
