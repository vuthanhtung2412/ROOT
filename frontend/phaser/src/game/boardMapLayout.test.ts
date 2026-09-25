import { describe, expect, it } from 'vitest'
import { FALL_BOARD_LAYOUT } from '#game/boardLayout.ts'
import {
  clearingHitTargetsForMap,
  computeBoardMapDisplayMetrics,
} from '#game/boardMapLayout.ts'
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'

describe('boardMapLayout', () => {
  it('fits map inside board band like Phaser BoardView', () => {
    const metrics = computeBoardMapDisplayMetrics({
      viewWidth: GAME_LOGICAL_WIDTH,
      viewHeight: GAME_LOGICAL_HEIGHT,
      naturalWidth: 2000,
      naturalHeight: 1500,
    })
    expect(metrics.mapDisplayWidth).toBeLessThanOrEqual(
      GAME_LOGICAL_WIDTH * 0.74 + 0.01,
    )
    expect(metrics.mapDisplayHeight).toBeLessThanOrEqual(
      GAME_LOGICAL_HEIGHT * 0.82 + 0.01,
    )
    expect(metrics.mapCenterX).toBe(GAME_LOGICAL_WIDTH * 0.5)
    expect(metrics.mapCenterY).toBe(GAME_LOGICAL_HEIGHT * 0.44)
  })

  it('builds one hit target per fall clearing', () => {
    const metrics = computeBoardMapDisplayMetrics({
      viewWidth: GAME_LOGICAL_WIDTH,
      viewHeight: GAME_LOGICAL_HEIGHT,
      naturalWidth: 2000,
      naturalHeight: 1500,
    })
    const targets = clearingHitTargetsForMap(FALL_BOARD_LAYOUT, metrics)
    expect(targets.length).toBe(FALL_BOARD_LAYOUT.clearings.length)
    expect(targets[0]?.clearingId).toBe(0)
  })
})
