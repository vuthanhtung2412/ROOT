import { describe, expect, it } from 'vitest'
import type { MenuFactionChoice } from '#game/hudStore.ts'
import { validatePartyFactions } from '#game/menuPartySetup.ts'
import {
  canAddSoloBot,
  canRemoveSoloBot,
  defaultSoloTable,
  soloPartyFactions,
  soloTrackChoices,
  withSoloBotRemoved,
  withSoloFactionPicked,
  withSoloSlotSelected,
  type SoloTable,
} from '#game/soloTableSetup.ts'

function soloTableFixture(overrides: Partial<SoloTable>): SoloTable {
  return { ...defaultSoloTable(), ...overrides }
}

function takenByOf(table: SoloTable): Record<string, MenuFactionChoice['takenBy']> {
  return Object.fromEntries(
    soloTrackChoices(table).map((choice: MenuFactionChoice) => [choice.faction, choice.takenBy]),
  )
}

describe('solo run table (Rootbotics 3.2)', () => {
  it('starts with the Alliance against both bots, the track on the player', () => {
    const table = defaultSoloTable()
    expect(soloPartyFactions(table)).toEqual(['alliance', 'mechanicalMarquise', 'electricEyrie'])
    expect(validatePartyFactions(soloPartyFactions(table)).ok).toBe(true)
    // The Vagabot still fits the fourth seat; the Automated Alliance clashes with the player.
    expect(canAddSoloBot(table)).toBe(true)
    expect(canAddSoloBot({ ...table, bots: [...table.bots, 'vagabot'] })).toBe(false)
  })

  it('shows only the woodland factions on the player track, blocking the ones a bot replaces', () => {
    const table = soloTableFixture({ bots: ['electricEyrie'] })
    expect(takenByOf(table)).toEqual({
      marquise: null,
      eyrie: 'other',
      alliance: 'you',
      vagabond: null,
      lizard: null,
      riverfolk: null,
    })
    expect(withSoloFactionPicked(table, 'eyrie')).toBe(table)
    expect(withSoloFactionPicked(table, 'marquise').playerFaction).toBe('marquise')
  })

  it('shows only the bots on a bot track, blocking the player faction bot and seated bots', () => {
    const table = soloTableFixture({
      playerFaction: 'marquise',
      bots: ['electricEyrie', 'automatedAlliance'],
      selectedSlot: { kind: 'newBot' },
    })
    expect(canAddSoloBot(table)).toBe(true)
    expect(takenByOf(table)).toEqual({
      mechanicalMarquise: 'other',
      electricEyrie: 'other',
      automatedAlliance: 'other',
      vagabot: null,
    })
  })

  it('adds a bot from ＋ and selects it, then replaces it from its own tile', () => {
    const table = soloTableFixture({ bots: ['electricEyrie'], selectedSlot: { kind: 'newBot' } })
    expect(canAddSoloBot(table)).toBe(true)
    const added = withSoloFactionPicked(table, 'mechanicalMarquise')
    expect(added.bots).toEqual(['electricEyrie', 'mechanicalMarquise'])
    expect(added.selectedSlot).toEqual({ kind: 'bot', botIndex: 1 })
    expect(takenByOf(added).mechanicalMarquise).toBe('you')

    const lone = soloTableFixture({ bots: ['electricEyrie'] })
    const replaced = withSoloFactionPicked(
      withSoloSlotSelected(lone, { kind: 'bot', botIndex: 0 }),
      'mechanicalMarquise',
    )
    expect(replaced.bots).toEqual(['mechanicalMarquise'])
  })

  it('removes a bot back to the player track, keeping the last one', () => {
    const table = soloTableFixture({ selectedSlot: { kind: 'bot', botIndex: 0 } })
    const removed = withSoloBotRemoved(table, 0)
    expect(removed.bots).toEqual(['electricEyrie'])
    expect(removed.selectedSlot).toEqual({ kind: 'player' })
    expect(canRemoveSoloBot(removed)).toBe(false)
    expect(withSoloBotRemoved(removed, 0)).toBe(removed)
  })

  it('plays the Eyrie against the Mechanical Marquise alone as a valid party', () => {
    const table = soloTableFixture({ playerFaction: 'eyrie', bots: ['mechanicalMarquise'] })
    expect(soloPartyFactions(table)).toEqual(['eyrie', 'mechanicalMarquise'])
    expect(validatePartyFactions(soloPartyFactions(table)).ok).toBe(true)
  })
})
