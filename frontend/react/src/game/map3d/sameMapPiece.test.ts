import { describe, expect, it } from 'vitest'
import type { MapPiece } from '#game/map3d/pieceMeshes.ts'
import { isSameMapPiece } from '#game/map3d/sameMapPiece.ts'

const MARQUISE_COLOR = 0xd9682b
const WARRIOR_COUNT = 3

function pieceFixture(overrides: Partial<MapPiece> = {}): MapPiece {
  return {
    key: 'clearing-1-warrior-0',
    shape: 'piece',
    textureKey: 'token-marquise-warrior',
    texturePath: '/assets/tokens/marquise/warrior.webp',
    color: MARQUISE_COLOR,
    count: WARRIOR_COUNT,
    ground: { x: 1, z: 2 },
    ...overrides,
  }
}

describe('isSameMapPiece', () => {
  it('holds for a piece that did not change between two board updates', () => {
    expect(isSameMapPiece(pieceFixture(), pieceFixture())).toBe(true)
  })

  it('fails when the stack grew', () => {
    expect(
      isSameMapPiece(pieceFixture(), pieceFixture({ count: WARRIOR_COUNT + 1 })),
    ).toBe(false)
  })

  it('fails when the piece moved', () => {
    expect(
      isSameMapPiece(pieceFixture(), pieceFixture({ ground: { x: 1, z: 3 } })),
    ).toBe(false)
  })

  it('fails when a building plot turned', () => {
    expect(
      isSameMapPiece(pieceFixture({ rotation: 0 }), pieceFixture({ rotation: 1 })),
    ).toBe(false)
  })
})
