import { FALL, FALL_LAYOUT } from '@root/lib'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { FallLayoutResponseSchema, FallMapResponseSchema } from '../schemas/map.js'

export const mapRoutes = new OpenAPIHono()

const fallMapRoute = createRoute({
  method: 'get',
  path: '/fall',
  tags: ['map'],
  summary: 'Fall map graph',
  responses: {
    200: {
      description: 'Static Fall graph',
      content: { 'application/json': { schema: FallMapResponseSchema } },
    },
  },
})

mapRoutes.openapi(fallMapRoute, (context) => {
  return context.json(
    {
      clearings: FALL.clearings,
      paths: FALL.paths,
      rivers: FALL.rivers,
      forests: FALL.forests,
      corners: [...FALL.corners],
      vagabondForest: FALL.vagabondForest,
    },
    200,
  )
})

const fallLayoutRoute = createRoute({
  method: 'get',
  path: '/fall/layout',
  tags: ['map'],
  summary: 'Fall map layout coords',
  responses: {
    200: {
      description: 'Normalized clearing layout',
      content: { 'application/json': { schema: FallLayoutResponseSchema } },
    },
  },
})

mapRoutes.openapi(fallLayoutRoute, (context) => {
  return context.json(FALL_LAYOUT, 200)
})
