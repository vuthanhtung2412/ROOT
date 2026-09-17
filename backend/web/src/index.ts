import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { LIB_NAME, LIB_VERSION } from '@root/lib'
import { onError } from './middleware/errors.js'
import { gameRoutes } from './routes/game.js'
import { mapRoutes } from './routes/map.js'

const app = new Hono()

app.onError(onError)

app.get('/', (c) => {
  return c.json({
    service: '@root/web',
    lib: { name: LIB_NAME, version: LIB_VERSION },
  })
})

app.route('/game', gameRoutes)
app.route('/map', mapRoutes)

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 3000),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
