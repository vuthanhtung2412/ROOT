/** Woodland Alliance board lookup — from faction board / root-base-rules. */

export type AllianceAbilityInfo = {
  id: string
  name: string
  description: string
}

export type AllianceSympathyTrackColumn = {
  tokenIndex: number
  supporterCost: number
  victoryPoints: number
}

export const ALLIANCE_SYMPATHY_TRACK_SLOT_COUNT = 10

/** Sympathy tokens L→R (index 0 = first placed). Cost / VP from board. */
/** Mirror `ALLIANCE_SYMPATHY_COST` / `ALLIANCE_SYMPATHY_VP` in lib boards. */
export const ALLIANCE_SYMPATHY_TRACK: readonly AllianceSympathyTrackColumn[] = [
  { tokenIndex: 0, supporterCost: 1, victoryPoints: 0 },
  { tokenIndex: 1, supporterCost: 1, victoryPoints: 1 },
  { tokenIndex: 2, supporterCost: 1, victoryPoints: 1 },
  { tokenIndex: 3, supporterCost: 2, victoryPoints: 1 },
  { tokenIndex: 4, supporterCost: 2, victoryPoints: 2 },
  { tokenIndex: 5, supporterCost: 2, victoryPoints: 2 },
  { tokenIndex: 6, supporterCost: 3, victoryPoints: 3 },
  { tokenIndex: 7, supporterCost: 3, victoryPoints: 4 },
  { tokenIndex: 8, supporterCost: 3, victoryPoints: 4 },
  { tokenIndex: 9, supporterCost: 3, victoryPoints: 4 },
]

export const ALLIANCE_ABILITIES: readonly AllianceAbilityInfo[] = [
  {
    id: 'guerrilla-war',
    name: 'Guerrilla War',
    description: 'As defender in battle, you deal the higher die roll.',
  },
  {
    id: 'craft',
    name: 'Craft',
    description: 'Daylight: activate sympathy to craft.',
  },
  {
    id: 'outrage',
    name: 'Outrage',
    description:
      'When an enemy removes sympathy, they give you a matching card or you draw.',
  },
]

export const ALLIANCE_TURN_CHEAT = [
  'Birdsong: Revolt and/or Spread Sympathy (0+), then end.',
  'Daylight: craft; Mobilize; Train; then end.',
  'Evening: military ops ≤ officers; draw; discard to 5.',
] as const
