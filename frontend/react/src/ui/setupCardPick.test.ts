import { describe, expect, it } from 'vitest'
import {
  setupCardPickOptions,
  setupCardPickTitle,
} from '#ui/setupCardPick.ts'

describe('setupCardPick', () => {
  it('titles the overlay after the kind of card', () => {
    expect(setupCardPickTitle('leader')).toBe('Choose Eyrie leader')
    expect(setupCardPickTitle('character')).toBe('Choose Vagabond character')
  })

  it('shows each Vagabond character card with its special and starting items', () => {
    expect(setupCardPickOptions('character', ['tinker', 'ranger'])).toEqual([
      {
        id: 'tinker',
        name: 'Tinker',
        imagePath: '/assets/character-boards/vagabond-tinker-front.webp',
        caption: [
          'Tinker',
          'Day Labor: Exhaust torch: take a discard-pile card matching your clearing (birds always match).',
          'Starts with: boot, torch, bag, hammer',
        ],
      },
      {
        id: 'ranger',
        name: 'Ranger',
        imagePath: '/assets/character-boards/vagabond-ranger-front.webp',
        caption: [
          'Ranger',
          'Hideout: Exhaust torch: repair three items, then end Daylight.',
          'Starts with: boot, torch, crossbow, sword',
        ],
      },
    ])
  })

  it('shows each Eyrie leader card with its viziers and ability', () => {
    expect(setupCardPickOptions('leader', ['builder'])).toEqual([
      {
        id: 'builder',
        name: 'Builder',
        imagePath: '/assets/eyrie-leaders/eyrie-leader-builder.webp',
        caption: [
          'Builder',
          'Viziers: Recruit & Move',
          'Ignore your Disdain for Trade when you craft.',
        ],
      },
    ])
  })

  it('falls back to a labelled placeholder for an unknown card', () => {
    expect(setupCardPickOptions('character', ['vagrant'])).toEqual([
      { id: 'vagrant', name: 'vagrant', imagePath: null, caption: ['vagrant'] },
    ])
  })
})
