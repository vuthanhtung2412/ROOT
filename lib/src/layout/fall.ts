import type { MapLayout } from '#layout/types.js'
import { FALL_LAYOUT_CLEARINGS } from '#public/fallMetadata.js'

/**
 * Normalised coords on resources/reference/map/base/autumn-map.jpg
 * (3479×3189). Ids match FALL. Hand-tuned against the board art.
 */
export const FALL_LAYOUT: MapLayout = {
  image: 'resources/reference/map/base/autumn-map.jpg',
  clearings: { ...FALL_LAYOUT_CLEARINGS },
}
