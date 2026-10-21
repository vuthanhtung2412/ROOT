import { describe, expect, it } from 'vitest'
import {
  defaultBotSettingsChoices,
  partyBotSettings,
  withBotDifficulty,
  withBotTraitToggled,
} from '#game/botSettingsMenu.ts'

describe('bot settings menu (Rootbotics 3.3)', () => {
  it('starts every bot at default with no trait', () => {
    expect(defaultBotSettingsChoices()).toEqual({
      mechanicalMarquise: { difficulty: 'default', traits: [] },
      electricEyrie: { difficulty: 'default', traits: [] },
    })
  })

  it('sets one bot difficulty and turns its traits on and off', () => {
    const nightmare = withBotDifficulty(defaultBotSettingsChoices(), {
      faction: 'electricEyrie',
      difficulty: 'nightmare',
    })
    const withSwoop = withBotTraitToggled(nightmare, { faction: 'electricEyrie', trait: 'swoop' })
    const withoutSwoop = withBotTraitToggled(withSwoop, { faction: 'electricEyrie', trait: 'swoop' })

    expect(withSwoop.electricEyrie).toEqual({ difficulty: 'nightmare', traits: ['swoop'] })
    expect(withoutSwoop.electricEyrie.traits).toEqual([])
    expect(withSwoop.mechanicalMarquise).toEqual({ difficulty: 'default', traits: [] })
  })

  it('sends settings of the seated bots only', () => {
    const choices = withBotDifficulty(defaultBotSettingsChoices(), {
      faction: 'mechanicalMarquise',
      difficulty: 'easy',
    })
    expect(partyBotSettings(['eyrie', 'mechanicalMarquise'], choices)).toEqual({
      mechanicalMarquise: { difficulty: 'easy', traits: [] },
    })
  })
})
