import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { loadRulebook } from '#aiPlayer/rulebook.js'
import { noGame } from '#middleware/errors.js'
import { isSeatScoped } from '#routes/game.js'
import { errorResponses, ViewQuerySchema } from '#schemas/common.js'
import { ExplainedActionsResponseSchema } from '#schemas/game.js'
import { store } from '#store/GameStore.js'
import { PLAYER_ID_HEADER } from '#view/actionSeatGuard.js'
import { explainLegalActions } from '#view/explainLegalActions.js'

export const explainedActionRoutes = new OpenAPIHono()

const getExplainedActionsRoute = createRoute({
  method: 'get',
  path: '/actions/explained',
  tags: ['game'],
  summary: 'List legal actions in plain words',
  description:
    'Each legal action type with its plain name, the Law of Root rules that cover it and its JSON Schema. No legal values: build the action from the rules and the board.',
  request: { query: ViewQuerySchema },
  responses: {
    200: {
      description: 'Explained legal actions',
      content: {
        'application/json': { schema: ExplainedActionsResponseSchema },
      },
    },
    ...errorResponses,
  },
})

explainedActionRoutes.openapi(getExplainedActionsRoute, (context) => {
  if (!store.game) noGame()
  const playerId: string | null = isSeatScoped(
    context.req.valid('query').view,
  )
    ? (context.req.header(PLAYER_ID_HEADER) ?? '')
    : null
  return context.json(
    { actions: explainLegalActions(store.game, playerId, loadRulebook()) },
    200,
  )
})
