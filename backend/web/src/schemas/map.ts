import { z } from '@hono/zod-openapi'

export const FallMapResponseSchema = z
  .object({
    clearings: z.array(z.unknown()),
    paths: z.array(z.tuple([z.number(), z.number()])),
    rivers: z.array(z.tuple([z.number(), z.number()])),
    forests: z.array(z.array(z.number())),
    corners: z.array(z.number()).length(4),
    vagabondForest: z.number().int(),
  })
  .openapi('FallMapResponse')

export const FallLayoutResponseSchema = z
  .object({
    image: z.string(),
    clearings: z.record(
      z.string(),
      z.object({
        x: z.number(),
        y: z.number(),
        r: z.number(),
      }),
    ),
  })
  .openapi('FallLayoutResponse')
