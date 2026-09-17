import type { MapLayout } from './types.js'

/** Hand-picked normalised coords on resources/reference/map/base/autumn-map.jpg (ids match FALL). */
export const FALL_LAYOUT: MapLayout = {
  image: 'resources/reference/map/base/autumn-map.jpg',
  clearings: {
    0: { x: 0.2, y: 0.2, r: 0.055 },
    1: { x: 0.8, y: 0.3, r: 0.055 },
    2: { x: 0.8, y: 0.8, r: 0.055 },
    3: { x: 0.2, y: 0.8, r: 0.055 },
    4: { x: 0.55, y: 0.2, r: 0.05 },
    5: { x: 0.85, y: 0.5, r: 0.05 },
    6: { x: 0.6, y: 0.7, r: 0.05 },
    7: { x: 0.4, y: 0.85, r: 0.05 },
    8: { x: 0.15, y: 0.4, r: 0.05 },
    9: { x: 0.4, y: 0.35, r: 0.05 },
    10: { x: 0.6, y: 0.5, r: 0.05 },
    11: { x: 0.4, y: 0.6, r: 0.055 },
  },
}
