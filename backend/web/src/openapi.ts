import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { compress } from 'hono/compress'
import { LIB_NAME, LIB_VERSION } from '@root/lib'
import { corsMiddleware } from '#middleware/cors.js'
import { onError } from '#middleware/errors.js'
import { aiPlayerRoutes } from '#routes/aiPlayer.js'
import { gameRoutes } from '#routes/game.js'
import { mapRoutes } from '#routes/map.js'

const openApiInfo = {
  openapi: '3.0.0' as const,
  info: {
    title: '@root/web',
    version: '0.0.1',
    description: 'Single-slot Root GP2 HTTP API (Marquise vs Eyrie)',
  },
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
app.route('/game', aiPlayerRoutes)
app.route('/map', mapRoutes)

app.doc('/doc', openApiInfo)

/** Dump OpenAPI JSON for `pnpm gen:openapi` / client codegen. */
export function getOpenApiDocument(): ReturnType<typeof app.getOpenAPIDocument> {
  return app.getOpenAPIDocument(openApiInfo)
}
