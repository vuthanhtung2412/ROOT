import type { MapLayout } from '#layout/types.js'

/**
 * Normalised coords on resources/reference/map/base/autumn-map.jpg
 * (3479×3189). Ids match FALL. Hand-tuned against the board art.
 */
export const FALL_LAYOUT: MapLayout = {
  image: 'resources/reference/map/base/autumn-map.jpg',
  clearings: {
    0: { x: 0.113, y: 0.119, r: 0.0715 },
    1: { x: 0.881, y: 0.226, r: 0.0715 },
    2: { x: 0.836, y: 0.868, r: 0.0715 },
    3: { x: 0.104, y: 0.819, r: 0.0715 },
    4: { x: 0.548, y: 0.097, r: 0.0715 },
    5: { x: 0.894, y: 0.531, r: 0.0715 },
    6: { x: 0.583, y: 0.78, r: 0.0715 },
    7: { x: 0.354, y: 0.912, r: 0.0715 },
    8: { x: 0.108, y: 0.387, r: 0.0715 },
    9: { x: 0.437, y: 0.294, r: 0.0715 },
    10: { x: 0.645, y: 0.497, r: 0.0715 },
    11: { x: 0.313, y: 0.545, r: 0.0715 },
  },
}
