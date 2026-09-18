import { z } from '@hono/zod-openapi'
import { FactionIdSchema, JsonObjectSchema } from './common.js'

export const GameStateSchema = JsonObjectSchema.openapi('GameState')

export const ActionSchema = z
  .object({ type: z.string() })
  .passthrough()
  .openapi('Action')

export const ActionSpecSchema = z
  .object({
    type: z.string(),
    actor: z.number().int().min(0).max(3),
    params: z.record(z.string(), z.array(z.unknown())).optional(),
  })
  .openapi('ActionSpec')

export const LogEntrySchema = JsonObjectSchema.openapi('LogEntry')

export const ActionResultSchema = z
  .object({
    state: GameStateSchema,
    log: z.array(LogEntrySchema),
  })
  .openapi('ActionResult')

export const CreateGameBodySchema = z
  .object({
    factions: z.array(FactionIdSchema).optional(),
  })
  .openapi('CreateGameBody')

export const CreateGameResponseSchema = z
  .object({
    state: GameStateSchema,
  })
  .openapi('CreateGameResponse')

export const JoinBodySchema = z
  .object({
    playerId: z.string().min(1),
  })
  .openapi('JoinBody')

export const GetGameResponseSchema = z
  .object({
    state: GameStateSchema,
    historyLength: z.number().int().nonnegative(),
  })
  .openapi('GetGameResponse')

export const GameSnapshotSchema = z
  .object({
    state: GameStateSchema,
    history: z.array(ActionSchema),
    log: z.array(LogEntrySchema),
    rng: z.object({
      seed: z.number(),
      cursor: z.number().int().nonnegative(),
    }),
  })
  .openapi('GameSnapshot')

export const LegalActionsResponseSchema = z
  .object({
    actions: z.array(ActionSpecSchema),
  })
  .openapi('LegalActionsResponse')

export const LogResponseSchema = z
  .object({
    log: z.array(LogEntrySchema),
  })
  .openapi('LogResponse')

export const UndoResponseSchema = z
  .object({
    state: GameStateSchema,
  })
  .openapi('UndoResponse')
