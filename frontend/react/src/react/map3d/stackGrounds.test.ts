import { describe, expect, it } from 'vitest'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import type { MapPiece } from '#game/map3d/pieceMeshes.ts'
import {
  rememberPieceGrounds,
  type PieceGrounds,
} from '#react/map3d/stackGrounds.ts'

const CAT_COLOR = 0xd9772b
const WARRIORS_KEY = '2-warrior--0'
const WOOD_KEY = '2-token-wood-0'
const FIRST_GROUND: MapGroundPoint = { x: 1, z: 2 }
const SECOND_GROUND: MapGroundPoint = { x: 3, z: 4 }
const MOVED_GROUND: MapGroundPoint = { x: 5, z: 6 }

function mapPiece(overrides: Partial<MapPiece>): MapPiece {
  return {
    key: WARRIORS_KEY,
    shape: 'piece',
    textureKey: '',
    texturePath: null,
    color: CAT_COLOR,
    count: 1,
    ground: FIRST_GROUND,
    ...overrides,
  }
}

describe('rememberPieceGrounds', () => {
  it('knows where every piece on the map stands', () => {
    const grounds: PieceGrounds = rememberPieceGrounds(new Map(), [
      mapPiece({ key: WARRIORS_KEY, ground: FIRST_GROUND }),
      mapPiece({ key: WOOD_KEY, ground: SECOND_GROUND }),
    ])

    expect(grounds.get(WARRIORS_KEY)).toEqual(FIRST_GROUND)
    expect(grounds.get(WOOD_KEY)).toEqual(SECOND_GROUND)
  })

  it('follows a piece that stands somewhere else now', () => {
    const before: PieceGrounds = rememberPieceGrounds(new Map(), [
      mapPiece({ key: WARRIORS_KEY, ground: FIRST_GROUND }),
    ])

    const after: PieceGrounds = rememberPieceGrounds(before, [
      mapPiece({ key: WARRIORS_KEY, ground: MOVED_GROUND }),
    ])

    expect(after.get(WARRIORS_KEY)).toEqual(MOVED_GROUND)
  })

  it('still knows where a piece that left the map last stood', () => {
    const before: PieceGrounds = rememberPieceGrounds(new Map(), [
      mapPiece({ key: WARRIORS_KEY, ground: FIRST_GROUND }),
    ])

    const after: PieceGrounds = rememberPieceGrounds(before, [])

    expect(after.get(WARRIORS_KEY)).toEqual(FIRST_GROUND)
  })

  it('leaves the grounds it was given untouched', () => {
    const before: PieceGrounds = rememberPieceGrounds(new Map(), [])

    rememberPieceGrounds(before, [mapPiece({ key: WARRIORS_KEY })])

    expect(before.size).toBe(0)
  })
})
