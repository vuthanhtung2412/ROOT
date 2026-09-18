import { serve } from '@hono/node-server'
import { app } from './openapi.js'

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 3000),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
    console.log(`OpenAPI doc: http://localhost:${info.port}/doc`)
  },
)
