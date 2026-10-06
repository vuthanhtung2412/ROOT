import { describe, expect, it } from 'vitest'
import { FALL_BOARD_LAYOUT } from '#game/boardLayout.ts'
import {
  BOARD_MAP_CENTER_Y_RATIO_LANDSCAPE,
  BOARD_MAP_HEIGHT_RATIO_LANDSCAPE,
  BOARD_MAP_WIDTH_RATIO_LANDSCAPE,
  clearingHitTargetsForMap,
  computeBoardMapDisplayMetrics,
} from '#game/boardMapLayout.ts'
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'

const ROUNDING_SLACK = 0.01

describe('boardMapLayout', () => {
  it('fits map inside board band like Phaser BoardView', () => {
    const metrics = computeBoardMapDisplayMetrics({
      viewWidth: GAME_LOGICAL_WIDTH,
      viewHeight: GAME_LOGICAL_HEIGHT,
      naturalWidth: 2000,
      naturalHeight: 1500,
    })
    expect(metrics.mapDisplayWidth).toBeLessThanOrEqual(
      GAME_LOGICAL_WIDTH * BOARD_MAP_WIDTH_RATIO_LANDSCAPE + ROUNDING_SLACK,
    )
    expect(metrics.mapDisplayHeight).toBeLessThanOrEqual(
      GAME_LOGICAL_HEIGHT * BOARD_MAP_HEIGHT_RATIO_LANDSCAPE + ROUNDING_SLACK,
    )
    expect(metrics.mapCenterX).toBe(GAME_LOGICAL_WIDTH * 0.5)
    expect(metrics.mapCenterY).toBe(
      GAME_LOGICAL_HEIGHT * BOARD_MAP_CENTER_Y_RATIO_LANDSCAPE,
    )
  })

  it('uses a wider band in portrait', () => {
    const landscape = computeBoardMapDisplayMetrics({
      viewWidth: GAME_LOGICAL_WIDTH,
      viewHeight: GAME_LOGICAL_HEIGHT,
      naturalWidth: 2000,
      naturalHeight: 1500,
      layoutMode: 'landscape',
    })
    const portrait = computeBoardMapDisplayMetrics({
      viewWidth: 370,
      viewHeight: 516,
      naturalWidth: 2000,
      naturalHeight: 1500,
      layoutMode: 'portrait',
    })
    const landscapeFill =
      landscape.mapDisplayWidth / GAME_LOGICAL_WIDTH
    const portraitFill = portrait.mapDisplayWidth / 370
    expect(portraitFill).toBeGreaterThan(landscapeFill)
  })

  it('builds one hit target per fall clearing', () => {
    const metrics = computeBoardMapDisplayMetrics({
      viewWidth: GAME_LOGICAL_WIDTH,
      viewHeight: GAME_LOGICAL_HEIGHT,
      naturalWidth: 2000,
      naturalHeight: 1500,
    })
    const targets = clearingHitTargetsForMap(FALL_BOARD_LAYOUT, metrics)
    expect(targets.length).toBe(12)
    expect(targets[0]?.clearingId).toBe(0)
  })
})
