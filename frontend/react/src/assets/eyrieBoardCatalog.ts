/** Eyrie board lookup tables — from faction board / root-base-rules. */

export type EyrieAbilityInfo = {
  id: string
  name: string
  description: string
}

export type EyrieLeaderInfo = {
  id: string
  name: string
  ability: string
}

export type EyrieRoostTrackColumn = {
  roostsOnMap: number
  eveningVictoryPoints: number
  drawBonus: number
}

export const EYRIE_ROOST_TRACK_SLOT_COUNT = 7

/** Roosts on map 1..7 → Evening VP / draw. Index 0 unused visually. */
export const EYRIE_ROOST_TRACK: readonly EyrieRoostTrackColumn[] = [
  { roostsOnMap: 1, eveningVictoryPoints: 0, drawBonus: 0 },
  { roostsOnMap: 2, eveningVictoryPoints: 1, drawBonus: 0 },
  { roostsOnMap: 3, eveningVictoryPoints: 2, drawBonus: 1 },
  { roostsOnMap: 4, eveningVictoryPoints: 3, drawBonus: 0 },
  { roostsOnMap: 5, eveningVictoryPoints: 4, drawBonus: 0 },
  { roostsOnMap: 6, eveningVictoryPoints: 4, drawBonus: 1 },
  { roostsOnMap: 7, eveningVictoryPoints: 5, drawBonus: 0 },
]

export const EYRIE_LEADER_LOOKUP: Record<string, EyrieLeaderInfo> = {
  builder: {
    id: 'builder',
    name: 'Builder',
    ability: 'Ignore your Disdain for Trade when you craft.',
  },
  charismatic: {
    id: 'charismatic',
    name: 'Charismatic',
    ability: 'You place two warriors, not one, each time you recruit.',
  },
  commander: {
    id: 'commander',
    name: 'Commander',
    ability: 'As attacker in battle, you deal an extra hit.',
  },
  despot: {
    id: 'despot',
    name: 'Despot',
    ability:
      'Score a point if you remove at least one building or token in battle.',
  },
}

export function lookupEyrieBoardLeader(leaderId: string): EyrieLeaderInfo | null {
  const leader = EYRIE_LEADER_LOOKUP[leaderId]
  if (leader === undefined) {
    return null
  }
  return leader
}

export const EYRIE_ABILITIES: readonly EyrieAbilityInfo[] = [
  {
    id: 'craft',
    name: 'Craft',
    description: 'Daylight before Decree: activate roosts to craft.',
  },
  {
    id: 'lords-of-the-forest',
    name: 'Lords of the Forest',
    description: 'You rule any clearings where you are tied in presence.',
  },
  {
    id: 'disdain-for-trade',
    name: 'Disdain for Trade',
    description: 'When crafting items, you score only one victory point.',
  },
]

export const EYRIE_TURN_CHEAT = [
  'Birdsong: emergency draw if empty; add 1–2 to Decree; new roost if none.',
  'Daylight: craft, then resolve Decree left→right (or Turmoil).',
  'Evening: score roosts track; draw 1 + bonuses; discard to 5.',
] as const

export const EYRIE_TURMOIL_CHEAT = [
  'Humiliate: −1 VP per bird on Decree (incl. Viziers).',
  'Purge: discard Decree except Loyal Viziers.',
  'Depose: flip leader; pick new; retuck Viziers.',
  'Rest: end Daylight; go to Evening.',
] as const
