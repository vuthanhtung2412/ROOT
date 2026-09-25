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

/** Match Phaser BoardView.fitMapToBoardArea band. */
export const BOARD_MAP_WIDTH_RATIO = 0.74
export const BOARD_MAP_HEIGHT_RATIO = 0.82
export const BOARD_MAP_CENTER_Y_RATIO = 0.44

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

export function computeBoardMapDisplayMetrics(input: {
  viewWidth: number
  viewHeight: number
  naturalWidth: number
  naturalHeight: number
}): BoardMapDisplayMetrics {
  const boardWidth = input.viewWidth * BOARD_MAP_WIDTH_RATIO
  const boardHeight = input.viewHeight * BOARD_MAP_HEIGHT_RATIO
  const scale = Math.min(
    boardWidth / input.naturalWidth,
    boardHeight / input.naturalHeight,
  )
  const mapDisplayWidth = input.naturalWidth * scale
  const mapDisplayHeight = input.naturalHeight * scale
  const mapCenterX = input.viewWidth * 0.5
  const mapCenterY = input.viewHeight * BOARD_MAP_CENTER_Y_RATIO
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
