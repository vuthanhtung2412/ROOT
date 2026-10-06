import { describe, expect, it } from 'vitest'
import { factionPortraitPath } from '#assets/factionPortraits.ts'

const PORTRAIT_FACTION_IDS: readonly string[] = [
  'marquise',
  'eyrie',
  'alliance',
  'vagabond',
  'lizard',
  'riverfolk',
]
const UNKNOWN_FACTION_ID = 'unknown-faction'

describe('factionPortraitPath', () => {
  it.each(PORTRAIT_FACTION_IDS)(
    'points %s at its portrait in public assets',
    (factionId: string) => {
      expect(factionPortraitPath(factionId)).toBe(
        `/assets/portraits/${factionId}.webp`,
      )
    },
  )

  it('returns null for a faction without a portrait', () => {
    expect(factionPortraitPath(UNKNOWN_FACTION_ID)).toBeNull()
  })
})
