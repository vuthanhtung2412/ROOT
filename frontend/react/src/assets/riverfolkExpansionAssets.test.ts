import { describe, expect, it } from 'vitest'
import {
  CORE_IMAGE_ASSETS,
  factionTextureKey,
  warriorTokenTextureKey,
} from '#assets/gameAssets.ts'
import {
  isSuitScopedPieceType,
  outcastMarkerTextureKey,
  RIVERFOLK_EXPANSION_IMAGE_ASSETS,
  suitScopedPieceTextureKey,
} from '#assets/riverfolkExpansionAssets.ts'
import { clearingRuler } from '#game/clearingRuler.ts'

describe('riverfolk expansion assets', () => {
  it('maps Lizard Cult and Riverfolk faction icons and warriors', () => {
    expect(factionTextureKey('lizard')).toBe('faction-lizard')
    expect(factionTextureKey('riverfolk')).toBe('faction-riverfolk')
    expect(warriorTokenTextureKey('lizard')).toBe('token-lizard-warrior')
    expect(warriorTokenTextureKey('riverfolk')).toBe('token-riverfolk-warrior')
  })

  it('picks garden and trade post art by clearing suit', () => {
    expect(suitScopedPieceTextureKey('garden', 'mouse')).toBe(
      'token-lizard-garden-mouse',
    )
    expect(suitScopedPieceTextureKey('tradePost', 'rabbit')).toBe(
      'token-riverfolk-trade-post-rabbit',
    )
    expect(suitScopedPieceTextureKey('sawmill', 'fox')).toBeNull()
    expect(isSuitScopedPieceType('garden')).toBe(true)
    expect(isSuitScopedPieceType(undefined)).toBe(false)
  })

  it('shows the Hated side of the outcast marker', () => {
    expect(outcastMarkerTextureKey(false)).toBe('token-lizard-outcast')
    expect(outcastMarkerTextureKey(true)).toBe('token-lizard-outcast-hated')
  })

  it('preloads every expansion image with the core assets', () => {
    for (const asset of RIVERFOLK_EXPANSION_IMAGE_ASSETS) {
      expect(CORE_IMAGE_ASSETS).toContainEqual(asset)
    }
  })
})

describe('clearingRuler with gardens', () => {
  it('Rule: 10.2.4 Pilgrims — a garden rules against more warriors', () => {
    const ruler = clearingRuler(
      {
        pieces: [
          { kind: 'building', owner: 1, type: 'garden' },
          { kind: 'warrior', owner: 0 },
          { kind: 'warrior', owner: 0 },
        ],
      },
      ['eyrie', 'lizard'],
    )
    expect(ruler).toBe(1)
  })
})
