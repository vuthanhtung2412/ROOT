import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { formatRuleLookup, loadRulebook } from '#aiPlayer/rulebook.js'

export const rulesRoutes = new OpenAPIHono()

const RulesQuerySchema = z.object({
  query: z.string().min(1).openapi({
    description:
      'A rule number such as 7.2 (that rule and its sub-rules) or keywords such as "ambush defender".',
  }),
})

const lookupRulesRoute = createRoute({
  method: 'get',
  path: '/rules',
  tags: ['rules'],
  summary: 'Look up the Law of Root',
  request: { query: RulesQuerySchema },
  responses: {
    200: {
      description: 'Matching rule sections as text',
      content: { 'text/plain': { schema: z.string() } },
    },
  },
})

rulesRoutes.openapi(lookupRulesRoute, (context) => {
  return context.text(
    formatRuleLookup(loadRulebook(), context.req.valid('query').query),
    200,
  )
})
