import type { Card } from '#cards/types.js'
import type { Suit } from '#map/types.js'
import type { FactionId, ItemType } from '#pieces/types.js'

/** Rule: Marquise > Buildings tracks — six columns left→right. */
export const MARQUISE_BUILD_COST = [0, 1, 2, 3, 3, 4] as const
export const MARQUISE_SAWMILL_VP = [0, 1, 2, 3, 4, 5] as const
export const MARQUISE_WORKSHOP_VP = [0, 2, 2, 3, 4, 5] as const
export const MARQUISE_RECRUITER_VP = [0, 1, 2, 3, 3, 4] as const
/** Recruiter draw bonus at column indices 2 and 4. */
export const MARQUISE_RECRUITER_DRAW_BONUS_INDICES = [2, 4] as const

export type BuildingTrack = {
  /** Buildings on track (5 at setup; leftmost column empty). */
  placed: number
}

export type MarquiseBoard = {
  kind: 'marquise'
  supply: { warriors: number; wood: number }
  tracks: {
    sawmill: BuildingTrack
    workshop: BuildingTrack
    recruiter: BuildingTrack
  }
}

export type EyrieBoard = {
  kind: 'eyrie'
  supply: { warriors: number }
  /** Leader in the Leader Card slot (null only while choosing). */
  leader: EyrieLeader | null
  /** Face-up leaders near the board — choosable (Law 7.3.3 / 7.7.3). */
  leadersFaceUp: EyrieLeader[]
  /** Face-down leaders set aside after depose (Law 7.7.3). */
  leadersFaceDown: EyrieLeader[]
  decree: Record<DecreeColumn, Card[]>
  roostTrack: { placed: number }
}

/** Evening VP by roosts on map (index 0..7). Rule: Eyrie roosts track. */
export const EYRIE_ROOST_VP = [0, 0, 1, 2, 3, 4, 4, 5] as const
/** Roosts-on-map thresholds that uncover +1 draw. */
export const EYRIE_ROOST_DRAW_BONUS_THRESHOLDS = [3, 6] as const

export type EyrieLeader = 'builder' | 'charismatic' | 'commander' | 'despot'
export const EYRIE_LEADERS: readonly EyrieLeader[] = [
  'builder',
  'charismatic',
  'commander',
  'despot',
]

/** Face-up pool = all leaders except the one in the slot; none face-down. */
export function eyrieLeaderPools(leader: EyrieLeader): {
  leadersFaceUp: EyrieLeader[]
  leadersFaceDown: EyrieLeader[]
} {
  return {
    leadersFaceUp: EYRIE_LEADERS.filter((candidate) => candidate !== leader),
    leadersFaceDown: [],
  }
}

export type DecreeColumn = 'recruit' | 'move' | 'battle' | 'build'
export const DECREE_COLUMNS: DecreeColumn[] = ['recruit', 'move', 'battle', 'build']


export type AllianceBoard = {
  kind: 'alliance'
  supply: { warriors: number }
  supporters: Card[]
  officers: number
  bases: Suit[]
  sympathyTrack: { placed: number }
}

export type VagabondItem = {
  type: ItemType
  exhausted: boolean
}

export type VagabondBoard = {
  kind: 'vagabond'
  satchel: VagabondItem[]
  tracks: { tea: VagabondItem[]; coin: VagabondItem[]; bag: VagabondItem[] }
  damaged: VagabondItem[]
  relationships: Record<FactionId, number | 'hostile'>
}

export type FactionBoard = MarquiseBoard | EyrieBoard | AllianceBoard | VagabondBoard
