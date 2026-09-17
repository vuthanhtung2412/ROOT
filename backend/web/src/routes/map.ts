import { FALL, FALL_LAYOUT } from '@root/lib'
import { Hono } from 'hono'

export const mapRoutes = new Hono()

mapRoutes.get('/fall', (c) => {
  return c.json({
    clearings: FALL.clearings,
    paths: FALL.paths,
    rivers: FALL.rivers,
    forests: FALL.forests,
    corners: FALL.corners,
    vagabondForest: FALL.vagabondForest,
  })
})

mapRoutes.get('/fall/layout', (c) => {
  return c.json(FALL_LAYOUT)
})
