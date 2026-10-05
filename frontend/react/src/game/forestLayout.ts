import {
  fallForestLayout,
  fallForestLayouts,
  type FallForestLayout,
} from '@root/lib/fall-metadata'
import type { BoardMapDisplayMetrics } from '#game/boardMapLayout.ts'

export type ForestPixelLayout = {
  forestIndex: number
  cornerClearingIds: readonly number[]
  corners: readonly { x: number; y: number }[]
  centroid: { x: number; y: number }
}

export type ForestPawnMarker = {
  forestIndex: number
  seat: number
  factionId: string
  /** Vagabond character id — picks the meeple art; null = default. */
  character: string | null
}

/** Pixel polygon + centroid for one Autumn forest (corners = bordering clearings). */
export function forestPixelLayout(
  forestIndex: number,
  metrics: BoardMapDisplayMetrics,
): ForestPixelLayout | null {
  const layout = fallForestLayout(forestIndex)
  if (layout === null) return null
  return toPixelLayout(layout, metrics)
}

export function allForestPixelLayouts(
  metrics: BoardMapDisplayMetrics,
): ForestPixelLayout[] {
  return fallForestLayouts().map((layout) => toPixelLayout(layout, metrics))
}

function toPixelLayout(
  layout: FallForestLayout,
  metrics: BoardMapDisplayMetrics,
): ForestPixelLayout {
  return {
    forestIndex: layout.forestIndex,
    cornerClearingIds: layout.cornerClearingIds,
    corners: layout.corners.map((corner) => ({
      x: metrics.mapLeft + corner.x * metrics.mapDisplayWidth,
      y: metrics.mapTop + corner.y * metrics.mapDisplayHeight,
    })),
    centroid: {
      x: metrics.mapLeft + layout.centroid.x * metrics.mapDisplayWidth,
      y: metrics.mapTop + layout.centroid.y * metrics.mapDisplayHeight,
    },
  }
}

export function isVagabondBoardWithForest(
  board: unknown,
): board is { kind: 'vagabond'; forest: number } {
  if (typeof board !== 'object' || board === null) return false
  if (Reflect.get(board, 'kind') !== 'vagabond') return false
  const forest = Reflect.get(board, 'forest')
  return typeof forest === 'number'
}
