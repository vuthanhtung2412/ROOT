import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { compress } from 'hono/compress'
import { LIB_NAME, LIB_VERSION } from '@root/lib'
import { corsMiddleware } from '#middleware/cors.js'
import { onError } from '#middleware/errors.js'
import { aiPlayerRoutes } from '#routes/aiPlayer.js'
import { explainedActionRoutes } from '#routes/explainedActions.js'
import { gameRoutes } from '#routes/game.js'
import { lobbyPlayerRoutes } from '#routes/lobbyPlayer.js'
import { mapRoutes } from '#routes/map.js'
import { playerToolRoutes } from '#routes/playerTools.js'
import { rulesRoutes } from '#routes/rules.js'
import { PLAYER_ID_HEADER } from '#view/actionSeatGuard.js'

const OPEN_API_DOCUMENT_PATH = '/doc'
const SWAGGER_UI_PATH = '/ui'
const PLAYER_ID_SECURITY_SCHEME = 'playerId'

const openApiInfo = {
  openapi: '3.0.0' as const,
  info: {
    title: '@root/web',
    version: '0.0.1',
    description: 'Single-slot Root GP2 HTTP API (Marquise vs Eyrie)',
  },
  // Lets the Swagger UI "Authorize" button send the caller's player id.
  security: [{ [PLAYER_ID_SECURITY_SCHEME]: [] }],
}

export const app = new OpenAPIHono()

app.use('*', corsMiddleware)
app.use('*', compress())
app.onError(onError)

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['meta'],
  summary: 'Service info',
  responses: {
    200: {
      description: 'Service metadata',
      content: {
        'application/json': {
          schema: z
            .object({
              service: z.string(),
              lib: z.object({
                name: z.string(),
                version: z.string(),
              }),
            })
            .openapi('ServiceInfo'),
        },
      },
    },
  },
})

app.openapi(healthRoute, (context) => {
  return context.json(
    {
      service: '@root/web',
      lib: { name: LIB_NAME, version: LIB_VERSION },
    },
    200,
  )
})

app.route('/game', gameRoutes)
app.route('/game', explainedActionRoutes)
app.route('/game', aiPlayerRoutes)
app.route('/game', lobbyPlayerRoutes)
app.route('/game', rulesRoutes)
app.route('/game', playerToolRoutes)
app.route('/map', mapRoutes)

app.openAPIRegistry.registerComponent(
  'securitySchemes',
  PLAYER_ID_SECURITY_SCHEME,
  { type: 'apiKey', in: 'header', name: PLAYER_ID_HEADER },
)

app.doc(OPEN_API_DOCUMENT_PATH, openApiInfo)
app.get(SWAGGER_UI_PATH, swaggerUI({ url: OPEN_API_DOCUMENT_PATH }))

/** Dump OpenAPI JSON for `pnpm gen:openapi` / client codegen. */
export function getOpenApiDocument(): ReturnType<typeof app.getOpenAPIDocument> {
  return app.getOpenAPIDocument(openApiInfo)
}
