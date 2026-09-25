import {
  FALL_BOARD_LAYOUT,
  layoutToPixelHitTargets,
  type BoardLayout,
  type ClearingPixelHitTarget,
} from '#game/boardLayout.ts'
import {
  GAME_LOGICAL_HEIGHT,
  GAME_LOGICAL_WIDTH,
} from '#game/hiDpi.ts'
import type { ViewportLayoutMode } from '#game/viewportLayout.ts'

/** Match legacy Phaser BoardView.fitMapToBoardArea band (landscape). */
export const BOARD_MAP_WIDTH_RATIO_LANDSCAPE = 0.74
export const BOARD_MAP_HEIGHT_RATIO_LANDSCAPE = 0.82
export const BOARD_MAP_CENTER_Y_RATIO_LANDSCAPE = 0.44

/** Portrait: fuller map — HUD moves to top/bottom chrome. */
export const BOARD_MAP_WIDTH_RATIO_PORTRAIT = 0.96
export const BOARD_MAP_HEIGHT_RATIO_PORTRAIT = 0.92
export const BOARD_MAP_CENTER_Y_RATIO_PORTRAIT = 0.48

export type BoardMapDisplayMetrics = {
  viewWidth: number
  viewHeight: number
  mapDisplayWidth: number
  mapDisplayHeight: number
  mapLeft: number
  mapTop: number
  mapCenterX: number
  mapCenterY: number
}

export function boardMapBandForLayoutMode(mode: ViewportLayoutMode): {
  widthRatio: number
  heightRatio: number
  centerYRatio: number
} {
  if (mode === 'portrait') {
    return {
      widthRatio: BOARD_MAP_WIDTH_RATIO_PORTRAIT,
      heightRatio: BOARD_MAP_HEIGHT_RATIO_PORTRAIT,
      centerYRatio: BOARD_MAP_CENTER_Y_RATIO_PORTRAIT,
    }
  }
  return {
    widthRatio: BOARD_MAP_WIDTH_RATIO_LANDSCAPE,
    heightRatio: BOARD_MAP_HEIGHT_RATIO_LANDSCAPE,
    centerYRatio: BOARD_MAP_CENTER_Y_RATIO_LANDSCAPE,
  }
}

export function computeBoardMapDisplayMetrics(input: {
  viewWidth: number
  viewHeight: number
  naturalWidth: number
  naturalHeight: number
  layoutMode?: ViewportLayoutMode
}): BoardMapDisplayMetrics {
  const band = boardMapBandForLayoutMode(input.layoutMode ?? 'landscape')
  const boardWidth = input.viewWidth * band.widthRatio
  const boardHeight = input.viewHeight * band.heightRatio
  const scale = Math.min(
    boardWidth / input.naturalWidth,
    boardHeight / input.naturalHeight,
  )
  const mapDisplayWidth = input.naturalWidth * scale
  const mapDisplayHeight = input.naturalHeight * scale
  const mapCenterX = input.viewWidth * 0.5
  const mapCenterY = input.viewHeight * band.centerYRatio
  return {
    viewWidth: input.viewWidth,
    viewHeight: input.viewHeight,
    mapDisplayWidth,
    mapDisplayHeight,
    mapLeft: mapCenterX - mapDisplayWidth / 2,
    mapTop: mapCenterY - mapDisplayHeight / 2,
    mapCenterX,
    mapCenterY,
  }
}

export function clearingHitTargetsForMap(
  layout: BoardLayout,
  metrics: BoardMapDisplayMetrics,
): ClearingPixelHitTarget[] {
  return layoutToPixelHitTargets(layout, {
    originX: metrics.mapLeft,
    originY: metrics.mapTop,
    width: metrics.mapDisplayWidth,
    height: metrics.mapDisplayHeight,
  })
}

export function defaultBoardMapMetricsForNaturalSize(
  naturalWidth: number,
  naturalHeight: number,
): BoardMapDisplayMetrics {
  return computeBoardMapDisplayMetrics({
    viewWidth: GAME_LOGICAL_WIDTH,
    viewHeight: GAME_LOGICAL_HEIGHT,
    naturalWidth,
    naturalHeight,
  })
}

export function defaultFallBoardHitTargets(
  naturalWidth: number,
  naturalHeight: number,
): ClearingPixelHitTarget[] {
  const metrics = defaultBoardMapMetricsForNaturalSize(
    naturalWidth,
    naturalHeight,
  )
  return clearingHitTargetsForMap(FALL_BOARD_LAYOUT, metrics)
}
