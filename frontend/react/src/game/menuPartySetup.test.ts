import { describe, expect, it } from 'vitest'
import {
  assignFactionAtSeat,
  defaultFactionsForPlayerCount,
  validatePartyFactions,
} from '#game/menuPartySetup.ts'

describe('menuPartySetup', () => {
  it('defaults include marquise for 2/3/4', () => {
    expect(defaultFactionsForPlayerCount(2)).toEqual(['marquise', 'eyrie'])
    expect(defaultFactionsForPlayerCount(3)).toEqual([
      'marquise',
      'eyrie',
      'alliance',
    ])
    expect(defaultFactionsForPlayerCount(4)).toEqual([
      'marquise',
      'eyrie',
      'alliance',
      'vagabond',
    ])
  })

  it('rejects duplicates and unknown factions; the Marquise is optional', () => {
    expect(validatePartyFactions(['lizard', 'riverfolk'])).toEqual({
      ok: true,
      factions: ['lizard', 'riverfolk'],
    })
    expect(validatePartyFactions(['marquise', 'duchy']).ok).toBe(false)
    expect(validatePartyFactions(['marquise', 'marquise']).ok).toBe(false)
    expect(validatePartyFactions(['marquise', 'eyrie'])).toEqual({
      ok: true,
      factions: ['marquise', 'eyrie'],
    })
  })

  it('assignFactionAtSeat swaps when target taken', () => {
    expect(
      assignFactionAtSeat(['marquise', 'eyrie', 'alliance'], 1, 'alliance'),
    ).toEqual(['marquise', 'alliance', 'eyrie'])
  })
})
