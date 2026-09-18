import type { MapLayout } from './types.js'

/**
 * Normalised coords on resources/reference/map/base/autumn-map.jpg
 * (3479×3189). Ids match FALL. Tuned so markers sit on grassy clearings
 * above the VP track and below the item row.
 */
export const FALL_LAYOUT: MapLayout = {
  image: 'resources/reference/map/base/autumn-map.jpg',
  clearings: {
    // Corners: NW fox, NE mouse, SE rabbit, SW rabbit
    0: { x: 0.175, y: 0.175, r: 0.048 },
    1: { x: 0.825, y: 0.185, r: 0.048 },
    2: { x: 0.830, y: 0.705, r: 0.048 },
    3: { x: 0.170, y: 0.705, r: 0.048 },
    // Edge / mid clearings
    4: { x: 0.500, y: 0.155, r: 0.045 },
    5: { x: 0.790, y: 0.400, r: 0.045 },
    6: { x: 0.640, y: 0.665, r: 0.045 },
    7: { x: 0.360, y: 0.680, r: 0.045 },
    8: { x: 0.135, y: 0.405, r: 0.045 },
    9: { x: 0.365, y: 0.310, r: 0.045 },
    10: { x: 0.635, y: 0.470, r: 0.050 },
    // Hub (most connected)
    11: { x: 0.430, y: 0.510, r: 0.050 },
  },
}
