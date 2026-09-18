import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { LIB_NAME, LIB_VERSION } from '@root/lib'
import { onError } from './middleware/errors.js'
import { gameRoutes } from './routes/game.js'
import { mapRoutes } from './routes/map.js'

const openApiInfo = {
  openapi: '3.0.0' as const,
  info: {
    title: '@root/web',
    version: '0.0.1',
    description: 'Single-slot Root GP2 HTTP API (Marquise vs Eyrie)',
  },
}

export const app = new OpenAPIHono()

app.onError(onError)

const rootRoute = createRoute({
  method: 'get',
  path: '/',
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

app.openapi(rootRoute, (context) => {
  return context.json(
    {
      service: '@root/web',
      lib: { name: LIB_NAME, version: LIB_VERSION },
    },
    200,
  )
})

app.route('/game', gameRoutes)
app.route('/map', mapRoutes)

app.doc('/doc', openApiInfo)

/** Dump OpenAPI JSON for `pnpm gen:openapi` / client codegen. */
export function getOpenApiDocument() {
  return app.getOpenAPIDocument(openApiInfo)
}
