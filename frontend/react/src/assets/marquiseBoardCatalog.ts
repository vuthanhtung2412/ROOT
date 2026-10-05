/** Marquise board lookup tables — from faction board / root-base-rules. */

export type MarquiseAbilityInfo = {
  id: string
  name: string
  description: string
}

export type MarquiseTrackColumn = {
  columnIndex: number
  woodCost: number
  sawmillVictoryPoints: number
  workshopVictoryPoints: number
  recruiterVictoryPoints: number
  recruiterDrawBonus: number
}

export const MARQUISE_TRACK_SLOT_COUNT = 6

/** Six columns left→right. Rule: Marquise > Buildings tracks. */
export const MARQUISE_BUILDING_TRACK: readonly MarquiseTrackColumn[] = [
  {
    columnIndex: 0,
    woodCost: 0,
    sawmillVictoryPoints: 0,
    workshopVictoryPoints: 0,
    recruiterVictoryPoints: 0,
    recruiterDrawBonus: 0,
  },
  {
    columnIndex: 1,
    woodCost: 1,
    sawmillVictoryPoints: 1,
    workshopVictoryPoints: 2,
    recruiterVictoryPoints: 1,
    recruiterDrawBonus: 0,
  },
  {
    columnIndex: 2,
    woodCost: 2,
    sawmillVictoryPoints: 2,
    workshopVictoryPoints: 2,
    recruiterVictoryPoints: 2,
    recruiterDrawBonus: 1,
  },
  {
    columnIndex: 3,
    woodCost: 3,
    sawmillVictoryPoints: 3,
    workshopVictoryPoints: 3,
    recruiterVictoryPoints: 3,
    recruiterDrawBonus: 0,
  },
  {
    columnIndex: 4,
    woodCost: 3,
    sawmillVictoryPoints: 4,
    workshopVictoryPoints: 4,
    recruiterVictoryPoints: 3,
    recruiterDrawBonus: 1,
  },
  {
    columnIndex: 5,
    woodCost: 4,
    sawmillVictoryPoints: 5,
    workshopVictoryPoints: 5,
    recruiterVictoryPoints: 4,
    recruiterDrawBonus: 0,
  },
]

export const MARQUISE_ABILITIES: readonly MarquiseAbilityInfo[] = [
  {
    id: 'craft',
    name: 'Craft',
    description: 'Daylight: activate workshops to craft.',
  },
  {
    id: 'keep',
    name: 'The Keep',
    description: 'Only you can place pieces in the clearing with the keep token.',
  },
  {
    id: 'field-hospitals',
    name: 'Field Hospitals',
    description:
      'When a warrior dies you may spend a matching card to return them to the Keep.',
  },
]

export const MARQUISE_TURN_CHEAT = [
  'Birdsong: place one wood at each sawmill.',
  'Daylight: craft, then up to 3 actions (+1 per bird spent).',
  'Evening: draw 1 + recruiter bonuses; discard to 5.',
] as const
