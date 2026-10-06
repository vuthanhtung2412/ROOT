import type { QuestCard } from '#cards/quests.js'
import type { Card } from '#cards/types.js'
import type { Suit } from '#map/types.js'
import type { FactionId, ItemType } from '#pieces/types.js'
import { createLizardBoard, type LizardBoard } from '#state/lizardBoard.js'
import {
  createRiverfolkBoard,
  type RiverfolkBoard,
} from '#state/riverfolkBoard.js'

/** Face-up quests drawn at Vagabond setup. Rule: Vagabond > Setup 3. */
export const FACE_UP_QUEST_COUNT = 3

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
/** Total roost pieces (1 starts on map + 6 on track). */
export const EYRIE_TOTAL_ROOSTS = 7
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

/** Rule: Alliance sympathy track — cost / VP by token index L→R (0–9). */
export const ALLIANCE_SYMPATHY_COST = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3] as const
export const ALLIANCE_SYMPATHY_VP = [0, 1, 1, 1, 2, 2, 3, 4, 4, 4] as const
export const ALLIANCE_SYMPATHY_TRACK_SIZE = 10
export const ALLIANCE_SUPPORTERS_CAP_WITHOUT_BASE = 5
export const ALLIANCE_STARTING_SUPPORTERS = 3
export const ALLIANCE_BASE_SUITS: readonly Suit[] = ['fox', 'rabbit', 'mouse']

export type AllianceBoard = {
  kind: 'alliance'
  supply: { warriors: number }
  supporters: Card[]
  officers: number
  /** Bases still on the faction board (not yet revolted onto the map). */
  bases: Suit[]
  /** Sympathy tokens remaining on the track. */
  sympathyTrack: { placed: number }
}

export type VagabondItem = {
  type: ItemType
  exhausted: boolean
}

/** Rule: Vagabond relationship track — aid cost / VP per step from Indifferent. */
export const VAGABOND_RELATIONSHIP_AID_COST = [1, 2, 3] as const
export const VAGABOND_RELATIONSHIP_VP = [1, 2, 2] as const
export const VAGABOND_ALLIED_STEP = 3
/** Rule: 9.2.5.I — tea/coin/bag tracks hold at most three matching items. */
export const VAGABOND_TRACK_ITEM_CAP = 3

export const THIEF_START_ITEMS: readonly ItemType[] = [
  'boot',
  'torch',
  'tea',
  'sword',
]

/** Rule: Appendix D — base game Vagabond characters. */
export const VAGABOND_CHARACTERS = ['thief', 'tinker', 'ranger'] as const

export type VagabondCharacter = (typeof VAGABOND_CHARACTERS)[number]

/** Snapshots saved before characters existed have no character: Thief. */
export const DEFAULT_VAGABOND_CHARACTER: VagabondCharacter = 'thief'

/** Rule: D.1.1 / D.2.1 / D.3.1 Starting Items. */
export const VAGABOND_START_ITEMS: Record<
  VagabondCharacter,
  readonly ItemType[]
> = {
  thief: THIEF_START_ITEMS,
  tinker: ['boot', 'torch', 'bag', 'hammer'],
  ranger: ['boot', 'torch', 'crossbow', 'sword'],
}

/** Rule: D.3.2 Hideout — repair up to this many items. */
export const HIDEOUT_REPAIR_COUNT = 3

export type VagabondBoard = {
  kind: 'vagabond'
  /** Null until chosen in setup. Rule: Vagabond > Setup 1. */
  character: VagabondCharacter | null
  satchel: VagabondItem[]
  tracks: { tea: VagabondItem[]; coin: VagabondItem[]; bag: VagabondItem[] }
  damaged: VagabondItem[]
  /** Completed quests in play area. Rule: Vagabond > Quest. */
  completedQuests: QuestCard[]
  /** 0..2 = Indifferent steps; 3 = Allied; 'hostile' = Hostile box. */
  relationships: Record<FactionId, number | 'hostile'>
  /** Non-null when pawn is in a forest (not on a clearing). */
  forest: number | null
}

export type FactionBoard =
  | MarquiseBoard
  | EyrieBoard
  | AllianceBoard
  | VagabondBoard
  | LizardBoard
  | RiverfolkBoard

export function createFactionBoard(faction: FactionId): FactionBoard {
  switch (faction) {
    case 'marquise':
      return {
        kind: 'marquise',
        supply: { warriors: 25, wood: 8 },
        tracks: {
          sawmill: { placed: 0 },
          workshop: { placed: 0 },
          recruiter: { placed: 0 },
        },
      }
    case 'eyrie':
      return {
        kind: 'eyrie',
        supply: { warriors: 20 },
        leader: null,
        leadersFaceUp: [...EYRIE_LEADERS],
        leadersFaceDown: [],
        decree: { recruit: [], move: [], battle: [], build: [] },
        roostTrack: { placed: 0 },
      }
    case 'alliance':
      return {
        kind: 'alliance',
        supply: { warriors: 10 },
        supporters: [],
        officers: 0,
        bases: [...ALLIANCE_BASE_SUITS],
        sympathyTrack: { placed: ALLIANCE_SYMPATHY_TRACK_SIZE },
      }
    case 'vagabond':
      return {
        kind: 'vagabond',
        character: null,
        satchel: [],
        tracks: { tea: [], coin: [], bag: [] },
        damaged: [],
        completedQuests: [],
        relationships: {
          marquise: 0,
          eyrie: 0,
          alliance: 0,
          vagabond: 0,
          lizard: 0,
          riverfolk: 0,
        },
        forest: null,
      }
    case 'lizard':
      return createLizardBoard()
    case 'riverfolk':
      return createRiverfolkBoard()
  }
}
