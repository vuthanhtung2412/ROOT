import { z } from '@hono/zod-openapi'

/** Opaque JSON object — GameState / snapshot fields stay engine-owned. */
export const JsonObjectSchema = z
  .record(z.string(), z.unknown())
  .openapi('JsonObject')

export const FactionIdSchema = z
  .enum(['marquise', 'eyrie', 'alliance', 'vagabond', 'lizard', 'riverfolk'])
  .openapi('FactionId')

export const ErrorBodySchema = z
  .object({
    code: z.string(),
    detail: z.unknown().nullable(),
  })
  .openapi('ErrorBody')

export const ReplaceQuerySchema = z.object({
  replace: z.enum(['1']).optional().openapi({
    description: 'Set to 1 to replace an existing game in the single slot',
  }),
})

export const UndoQuerySchema = z.object({
  scope: z.enum(['turn']).optional().openapi({
    description:
      'turn = take back the latest action of the current turn (what a player may do). Omitted = rewind any action (hotseat dev tool).',
  }),
})

export const errorResponses = {
  400: {
    description: 'Rule or request error',
    content: { 'application/json': { schema: ErrorBodySchema } },
  },
  404: {
    description: 'No game in slot',
    content: { 'application/json': { schema: ErrorBodySchema } },
  },
  409: {
    description: 'Game already exists',
    content: { 'application/json': { schema: ErrorBodySchema } },
  },
} as const
