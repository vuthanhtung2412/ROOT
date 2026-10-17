import { describe, expect, it } from 'vitest'
import {
  assignFactionAtSeat,
  defaultFactionsForPlayerCount,
  isSoloFactionId,
  SOLO_FACTION_IDS,
  soloPartyFactions,
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

  it('seats bots, never beside the faction they replace, and needs one human', () => {
    expect(validatePartyFactions(['marquise', 'electricEyrie'])).toEqual({
      ok: true,
      factions: ['marquise', 'electricEyrie'],
    })
    expect(validatePartyFactions(['eyrie', 'electricEyrie']).ok).toBe(false)
    expect(
      validatePartyFactions(['mechanicalMarquise', 'electricEyrie']),
    ).toEqual({ ok: false, reason: 'Seat at least one human player' })
  })

  it('assignFactionAtSeat swaps out the faction a bot replaces', () => {
    expect(
      assignFactionAtSeat(['marquise', 'eyrie'], 1, 'mechanicalMarquise'),
    ).toEqual(['eyrie', 'mechanicalMarquise'])
  })

  it('solo seats the player, then both bots, and is a valid party', () => {
    for (const faction of SOLO_FACTION_IDS) {
      const factions = soloPartyFactions(faction)
      expect(factions).toEqual([faction, 'mechanicalMarquise', 'electricEyrie'])
      expect(validatePartyFactions(factions).ok).toBe(true)
    }
    expect(isSoloFactionId('marquise')).toBe(false)
    expect(isSoloFactionId('riverfolk')).toBe(true)
  })

  it('assignFactionAtSeat swaps when target taken', () => {
    expect(
      assignFactionAtSeat(['marquise', 'eyrie', 'alliance'], 1, 'alliance'),
    ).toEqual(['marquise', 'alliance', 'eyrie'])
  })
})
