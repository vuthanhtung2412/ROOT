import { z } from '@hono/zod-openapi'

/** Opaque JSON object — GameState / snapshot fields stay engine-owned. */
export const JsonObjectSchema = z
  .record(z.string(), z.unknown())
  .openapi('JsonObject')

export const FactionIdSchema = z
  .enum([
    'marquise',
    'eyrie',
    'alliance',
    'vagabond',
    'lizard',
    'riverfolk',
    'mechanicalMarquise',
    'electricEyrie',
    'automatedAlliance',
    'vagabot',
  ])
  .openapi('FactionId', {
    description:
      'mechanicalMarquise, electricEyrie, automatedAlliance and vagabot are Rootbotics bots: seated and played by the engine.',
  })

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

/** `?view=player`: answer as the caller's seat, even in a hotseat game. */
export const PLAYER_VIEW = 'player'

export const ViewQuerySchema = z.object({
  view: z.enum([PLAYER_VIEW]).optional().openapi({
    description:
      'player = seat-scoped call: other hands hidden, only the seat of the X-Player-Id caller may act. Online games are always seat-scoped.',
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

/** Opening an online room: the server holds as many as it allows. */
export const roomLimitResponse = {
  503: {
    description: 'Every online room is in use',
    content: { 'application/json': { schema: ErrorBodySchema } },
  },
} as const
