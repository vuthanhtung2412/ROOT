import { describe, expect, it } from 'vitest'
import {
  ALLIANCE_BOARD_LAYOUT,
  EYRIE_BOARD_LAYOUT,
  MARQUISE_BOARD_LAYOUT,
  VAGABOND_BOARD_LAYOUT,
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

  it('loads Alliance sympathy track + suit base slots', () => {
    expect(ALLIANCE_BOARD_LAYOUT.tracks.map((track) => track.id)).toEqual([
      'sympathy',
    ])
    expect(ALLIANCE_BOARD_LAYOUT.tracks[0]?.cells).toBe(10)
    expect(findBoardLayoutRegion(ALLIANCE_BOARD_LAYOUT, 'base-fox')).toEqual(
      expect.objectContaining({ x: 656, y: 690, width: 102, height: 102 }),
    )
    expect(findBoardLayoutRegion(ALLIANCE_BOARD_LAYOUT, 'base-rabbit')).toEqual(
      expect.objectContaining({ x: 767, y: 690, width: 102, height: 102 }),
    )
    expect(findBoardLayoutRegion(ALLIANCE_BOARD_LAYOUT, 'base-mouse')).toEqual(
      expect.objectContaining({ x: 877, y: 690, width: 102, height: 102 }),
    )
    expect(
      findBoardLayoutRegion(ALLIANCE_BOARD_LAYOUT, 'supply-warriors'),
    ).toEqual(
      expect.objectContaining({ x: 522, y: 690, width: 102, height: 102 }),
    )
    expect(findBoardLayoutRegion(ALLIANCE_BOARD_LAYOUT, 'officers')).toEqual(
      expect.objectContaining({ x: 1141, y: 679, width: 357, height: 177 }),
    )
    expect(trackCellRegion(ALLIANCE_BOARD_LAYOUT, 'sympathy', 0)).toEqual(
      expect.objectContaining({ x: 320, y: 1000, width: 90, height: 90 }),
    )
    expect(trackCellRegion(ALLIANCE_BOARD_LAYOUT, 'sympathy', 9)).toEqual(
      expect.objectContaining({ x: 1308, y: 1000, width: 90, height: 90 }),
    )
  })

  it('loads Vagabond satchel + relationship + item tracks', () => {
    expect(VAGABOND_BOARD_LAYOUT.tracks.map((track) => track.id)).toEqual([
      'relationship-development',
      'tea',
      'coin',
      'bag',
    ])
    expect(findBoardLayoutRegion(VAGABOND_BOARD_LAYOUT, 'satchel')).toEqual(
      expect.objectContaining({ x: 666, y: 761, width: 460, height: 274 }),
    )
    expect(
      findBoardLayoutRegion(VAGABOND_BOARD_LAYOUT, 'character-slot'),
    ).toEqual(
      expect.objectContaining({ x: 1176, y: 694, width: 353, height: 492 }),
    )
    expect(
      findBoardLayoutRegion(VAGABOND_BOARD_LAYOUT, 'relationship-hostile'),
    ).toEqual(
      expect.objectContaining({ x: 676, y: 409, width: 314, height: 160 }),
    )
    expect(
      findBoardLayoutRegion(VAGABOND_BOARD_LAYOUT, 'crafted-items'),
    ).toBeNull()
    expect(
      trackCellRegion(VAGABOND_BOARD_LAYOUT, 'relationship-development', 3),
    ).toEqual(
      expect.objectContaining({ x: 1379, y: 278, width: 119, height: 289 }),
    )
    expect(trackCellRegion(VAGABOND_BOARD_LAYOUT, 'tea', 0)).toEqual(
      expect.objectContaining({ x: 332, y: 327, width: 89, height: 89 }),
    )
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
