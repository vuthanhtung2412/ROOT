import { z } from '@hono/zod-openapi'
import { AiPlayerSchema } from '#schemas/aiPlayer.js'
import { FactionIdSchema, JsonObjectSchema } from '#schemas/common.js'
import { LOBBY_MODES } from '#store/GameStore.js'

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

export const LobbyModeSchema = z.enum(LOBBY_MODES).openapi('LobbyMode')

export const CreateGameBodySchema = z
  .object({
    factions: z.array(FactionIdSchema).optional().openapi({
      description:
        'Faction of each seat. Empty list = open lobby: every player picks an untaken faction when joining.',
    }),
    mode: LobbyModeSchema.optional(),
  })
  .openapi('CreateGameBody')

export const CreateGameResponseSchema = z
  .object({
    state: GameStateSchema,
    mode: LobbyModeSchema,
  })
  .openapi('CreateGameResponse')

export const JoinBodySchema = z
  .object({
    playerId: z.string().min(1),
    faction: FactionIdSchema.optional().openapi({
      description:
        'Open lobby (created with no factions): the faction this player picks. Joining again changes the pick.',
    }),
  })
  .openapi('JoinBody')

export const GetGameResponseSchema = z
  .object({
    state: GameStateSchema,
    historyLength: z.number().int().nonnegative(),
    mode: LobbyModeSchema,
    aiPlayers: z.array(AiPlayerSchema),
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
