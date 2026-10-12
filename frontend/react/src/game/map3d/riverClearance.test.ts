import { describe, expect, it } from 'vitest'
import { FALL_BOARD_LAYOUT } from '#game/boardLayout.ts'
import {
  createMapTerrain,
  type ClearingGround,
  type MapTerrain,
} from '#game/map3d/mapTerrain.ts'
import {
  groundDistance,
  type MapGroundPoint,
} from '#game/map3d/mapWorldSpace.ts'
import type { MapPiece } from '#game/map3d/pieceMeshes.ts'
import {
  groundClearOfRiver,
  type SlotSite,
} from '#game/map3d/riverClearance.ts'
import { mapPiecesForBoard } from '#react/map3d/mapPieces.ts'

const RIVER_CLEARANCE = 2.8
const SLOT_MINIMUM_SPACING = 2.3
const RIVER_HALF_LENGTH = 20
const VIEW_WIDTH = 1600
const VIEW_HEIGHT = 900

function clearingFixture(): ClearingGround {
  return { clearingId: 0, center: { x: 0, z: 0 }, radius: 4.8 }
}

/** A river running straight north to south at `x`. */
function riverFixture(x: number): MapGroundPoint[] {
  return Array.from(
    { length: RIVER_HALF_LENGTH * 2 + 1 },
    (_, index: number): MapGroundPoint => ({
      x,
      z: index - RIVER_HALF_LENGTH,
    }),
  )
}

function siteFixture(riverX: number): SlotSite {
  return { clearing: clearingFixture(), river: riverFixture(riverX) }
}

function distanceToRiver(
  ground: MapGroundPoint,
  river: readonly MapGroundPoint[],
): number {
  return Math.min(
    ...river.map((point: MapGroundPoint): number =>
      groundDistance(ground, point),
    ),
  )
}

describe('groundClearOfRiver', () => {
  it('keeps a slot that is already on dry land', () => {
    const desired: MapGroundPoint = { x: -3.5, z: -1 }
    expect(groundClearOfRiver(desired, siteFixture(0), [])).toEqual(desired)
  })

  it('moves a slot out of the river, staying in the clearing', () => {
    const site: SlotSite = siteFixture(0)
    const moved: MapGroundPoint = groundClearOfRiver(
      { x: -0.5, z: -2 },
      site,
      [],
    )
    expect(distanceToRiver(moved, site.river)).toBeGreaterThanOrEqual(
      RIVER_CLEARANCE,
    )
    expect(groundDistance(moved, site.clearing.center)).toBeLessThanOrEqual(
      site.clearing.radius,
    )
    expect(moved.x).toBeLessThan(0)
  })

  it('does not move a slot onto one already laid out', () => {
    const taken: MapGroundPoint = { x: -3, z: -2 }
    const moved: MapGroundPoint = groundClearOfRiver(
      { x: -0.5, z: -2 },
      siteFixture(0),
      [taken],
    )
    expect(groundDistance(moved, taken)).toBeGreaterThanOrEqual(
      SLOT_MINIMUM_SPACING,
    )
  })
})

describe('building slots of the Autumn map', () => {
  it('all lie clear of the river and of each other', () => {
    const terrain: MapTerrain = createMapTerrain(FALL_BOARD_LAYOUT, {
      view: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
      focus: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
      focusOffsetX: 0,
    })
    const slots: MapPiece[] = mapPiecesForBoard({
      clearings: [],
      factions: [],
      clearingGrounds: terrain.clearings,
      forestGrounds: [],
      forestPawns: [],
      river: terrain.river,
    })
    expect(slots.length).toBeGreaterThan(0)
    for (const slot of slots) {
      expect(
        distanceToRiver(slot.ground, terrain.river),
        slot.key,
      ).toBeGreaterThanOrEqual(RIVER_CLEARANCE)
      for (const other of slots) {
        if (other !== slot) {
          expect(
            groundDistance(slot.ground, other.ground),
            `${slot.key} / ${other.key}`,
          ).toBeGreaterThanOrEqual(SLOT_MINIMUM_SPACING)
        }
      }
    }
  })
})
