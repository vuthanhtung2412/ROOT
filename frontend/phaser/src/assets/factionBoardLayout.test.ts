import { describe, expect, it } from 'vitest'
import {
  EYRIE_BOARD_LAYOUT,
  MARQUISE_BOARD_LAYOUT,
  findBoardLayoutRegion,
  placeBoardImage,
  scaleBoardLayoutRegion,
  trackCellRegion,
} from '#assets/factionBoardLayout.ts'

describe('factionBoardLayout', () => {
  it('loads Marquise tracks + supply regions from helper export', () => {
    expect(MARQUISE_BOARD_LAYOUT.naturalWidth).toBe(1600)
    expect(MARQUISE_BOARD_LAYOUT.tracks.map((track) => track.id)).toEqual([
      'sawmill',
      'workshop',
      'recruiter',
    ])
    expect(findBoardLayoutRegion(MARQUISE_BOARD_LAYOUT, 'supply-wood')).toEqual(
      expect.objectContaining({ width: 101, height: 101 }),
    )
    expect(trackCellRegion(MARQUISE_BOARD_LAYOUT, 'sawmill', 0)?.x).toBe(774)
    expect(trackCellRegion(MARQUISE_BOARD_LAYOUT, 'sawmill', 5)?.x).toBe(1394)
  })

  it('loads Eyrie roost track + leader-slot', () => {
    expect(EYRIE_BOARD_LAYOUT.tracks[0]?.cells).toBe(7)
    expect(findBoardLayoutRegion(EYRIE_BOARD_LAYOUT, 'leader-slot')).toEqual(
      expect.objectContaining({ x: 1176, y: 687, width: 369, height: 510 }),
    )
    expect(findBoardLayoutRegion(EYRIE_BOARD_LAYOUT, 'crafted-items')).toEqual(
      expect.objectContaining({ x: 1086, y: 358, width: 395, height: 92 }),
    )
    expect(findBoardLayoutRegion(EYRIE_BOARD_LAYOUT, 'decree-recruit')).toEqual(
      expect.objectContaining({ x: 0, y: 0, width: 376, height: 57 }),
    )
    expect(findBoardLayoutRegion(EYRIE_BOARD_LAYOUT, 'decree-build')).toEqual(
      expect.objectContaining({ x: 1230, y: 0, width: 370, height: 57 }),
    )
    expect(trackCellRegion(EYRIE_BOARD_LAYOUT, 'roost', 6)?.x).toBe(1432)
  })

  it('scales layout rects onto placed board image', () => {
    const placement = placeBoardImage({
      viewWidth: 1600,
      viewHeight: 900,
      naturalWidth: 1600,
      naturalHeight: 1242,
      maxWidthRatio: 1,
      maxHeightRatio: 1,
      topRatio: 0,
    })
    const region = findBoardLayoutRegion(EYRIE_BOARD_LAYOUT, 'supply-warriors')
    expect(region).not.toBeNull()
    if (region === null) {
      throw new Error('expected supply-warriors')
    }
    const scaled = scaleBoardLayoutRegion(region, placement)
    expect(scaled.x).toBeCloseTo(region.x * placement.scale + placement.left)
    expect(scaled.width).toBeCloseTo(region.width * placement.scale)
  })
})
