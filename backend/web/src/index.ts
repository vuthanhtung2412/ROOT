import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { LIB_NAME, LIB_VERSION } from '@root/lib'

const app = new Hono()

app.get('/', (c) => {
  return c.json({
    service: '@root/web',
    lib: { name: LIB_NAME, version: LIB_VERSION },
  })
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
