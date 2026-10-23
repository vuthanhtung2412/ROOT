import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  isJsonValue,
  READ_ONLY_PLAYER_TOOL_NAMES,
  runAiPlayerTool,
} from '#aiPlayer/aiPlayerTools.js'
import { loadRulebook } from '#aiPlayer/rulebook.js'
import { HttpError, noGame } from '#middleware/errors.js'
import { resolveRoom } from '#middleware/roomResolver.js'
import { errorResponses, JsonObjectSchema } from '#schemas/common.js'
import { PLAYER_ID_HEADER } from '#view/actionSeatGuard.js'

export const playerToolRoutes = new OpenAPIHono()

const PlayerToolParamsSchema = z.object({
  tool: z.string().openapi({
    description: `One of: ${READ_ONLY_PLAYER_TOOL_NAMES.join(', ')}.`,
  }),
})

const PlayerToolResultSchema = z
  .object({
    /** What the tool answered: JSON text, or the reason it could not answer. */
    content: z.string(),
    isError: z.boolean(),
  })
  .openapi('PlayerToolResult')

const runPlayerToolRoute = createRoute({
  method: 'post',
  path: '/player-tools/{tool}',
  tags: ['game'],
  summary:
    'Run a read-only player tool as the seat of the X-Player-Id caller (what an AI player sees)',
  request: {
    params: PlayerToolParamsSchema,
    body: {
      content: { 'application/json': { schema: JsonObjectSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'The answer of the tool; nothing in the game changed',
      content: { 'application/json': { schema: PlayerToolResultSchema } },
    },
    ...errorResponses,
  },
})

playerToolRoutes.openapi(runPlayerToolRoute, (context) => {
  const game = resolveRoom(context.req.header(PLAYER_ID_HEADER)).game ?? noGame()
  const { tool } = context.req.valid('param')
  if (!READ_ONLY_PLAYER_TOOL_NAMES.includes(tool)) {
    throw new HttpError(400, 'UNKNOWN_PLAYER_TOOL', {
      tool,
      known: READ_ONLY_PLAYER_TOOL_NAMES,
    })
  }
  const input = context.req.valid('json')
  if (!isJsonValue(input)) {
    throw new HttpError(400, 'BAD_TOOL_INPUT')
  }
  const result = runAiPlayerTool(
    {
      game,
      playerId: context.req.header(PLAYER_ID_HEADER) ?? '',
      rulebook: loadRulebook(),
      // Read-only tools never change the game: nothing to save or push.
      onGameChanged: (): void => {},
    },
    { name: tool, input },
  )
  return context.json({ content: result.content, isError: result.isError }, 200)
})
