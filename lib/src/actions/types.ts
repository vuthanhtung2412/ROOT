import type { ClearingId } from '#map/types.js'
import type { BuildingType, ItemType, Seat } from '#pieces/types.js'
import type { DecreeColumn, EyrieLeader } from '#state/boards.js'

export type MarchMove = {
  from: ClearingId
  to: ClearingId
  count: number
}

export type AddToDecreeCard = {
  cardId: string
  column: DecreeColumn
}

/** Marquise daylight build track (not roost/base). */
export type MarquiseBuildingType = Extract<
  BuildingType,
  'sawmill' | 'workshop' | 'recruiter'
>

/** Paired Marquise overwork: card × sawmill clearing (6.5.5). */
export type OverworkChoice = {
  cardId: string
  clearing: ClearingId
}

/** Paired Marquise build: clearing × building type (6.5.4). */
export type BuildChoice = {
  clearing: ClearingId
  building: MarquiseBuildingType
}

/** Paired battle target: clearing × defender seat. */
export type BattleTargetChoice = {
  clearing: ClearingId
  defender: Seat
}

/** Paired Alliance revolt / spread: clearing × supporter ids. */
export type RevoltChoice = {
  clearing: ClearingId
  supporterIds: string[]
}

/** Alias — same shape as revolt spend choice. */
export type SpreadSympathyChoice = RevoltChoice

/** Rule: 9.2.9.IIb — optional Allied warriors dragged with pawn move. */
export type VagabondMoveChoice = {
  to: ClearingId
  allySeat?: Seat
  allyCount?: number
}

/**
 * Typed UI choice metadata for ActionSpec.
 * Prefer paired fields (`options`, `targets`, `moves`) over parallel arrays
 * (`clearing`+`defender`, `from`+`to`) — zip-by-index shapes go away in
 * faction emitter commits.
 */
export type ActionChoiceParams = {
  cardIds?: string[]
  birdCardIds?: string[]
  columns?: DecreeColumn[]
  /** Eyrie decree / newRoost flat clearing domain (singular key, historical). */
  clearing?: ClearingId[]
  clearings?: ClearingId[]
  building?: BuildingType[]
  defender?: Seat[]
  from?: ClearingId[]
  to?: ClearingId[]
  moves?: MarchMove[]
  /**
   * Correlated choices: overwork pairs, build pairs, or addToDecree card×column.
   * Emitter picks one element shape per action type.
   */
  options?: OverworkChoice[] | BuildChoice[] | AddToDecreeCard[] | RevoltChoice[]
  /** Correlated battle / decree-battle targets. */
  targets?: BattleTargetChoice[]
  decline?: true[]
  pieceIds?: string[]
  order?: Seat[][]
  useEffect?: boolean[]
  column?: DecreeColumn[]
  leaders?: EyrieLeader[]
  supporterIds?: string[]
  op?: Array<'move' | 'battle' | 'recruit' | 'organize'>
  /** Vagabond slip — forest destination indices. */
  forests?: number[]
  /** Vagabond quest — face-up quest card ids. */
  questIds?: string[]
  /** Vagabond quest reward choice. */
  rewards?: Array<'vp' | 'draw'>
  /** Vagabond rearrange — track item types that can move. */
  itemTypes?: Array<'tea' | 'coin' | 'bag'>
  /** Vagabond rearrange direction. */
  rearrangeFrom?: Array<'track' | 'satchel'>
  /** Vagabond Allied escort choices for move. */
  vbMoves?: VagabondMoveChoice[]
  /** Vagabond Allied warriors treated as own in battle (9.2.9.IIc). */
  alliedSeat?: Seat[]
}

export type Action =
  | { type: 'join'; playerId: string }
  | { type: 'start' }
  | { type: 'birdsongWood' }
  | { type: 'eveningDraw' }
  | { type: 'emergencyOrders' }
  | { type: 'eveningScore' }
  | { type: 'endPhase' }
  | { type: 'spendBird'; cardId: string }
  | { type: 'recruit' }
  | { type: 'march'; moves: MarchMove[] }
  | { type: 'build'; clearing: ClearingId; building: BuildingType }
  | { type: 'overwork'; clearing: ClearingId; cardId: string }
  | { type: 'craft'; cardId: string }
  | { type: 'battle'; clearing: ClearingId; defender: Seat }
  | { type: 'swapMeet'; target: Seat; giveCardId: string }
  | { type: 'charmOffensive'; target: Seat }
  | { type: 'informantsTakeAmbush'; cardId: string }
  | {
      type: 'leagueMove'
      itemIndex: number
      from: ClearingId
      to: ClearingId
      count: number
    }
  | {
      type: 'leagueBattle'
      itemIndex: number
      clearing: ClearingId
      defender: Seat
    }
  | {
      type: 'propagandaBureau'
      cardId: string
      clearing: ClearingId
      pieceId: string
    }
  | { type: 'saboteurs'; target: Seat; cardId: string }
  | {
      type: 'falseOrders'
      target: Seat
      from: ClearingId
      to: ClearingId
    }
  | {
      type: 'eyrieEmigre'
      from: ClearingId
      to: ClearingId
      count: number
      defender: Seat
    }
  | { type: 'discard'; cardIds: string[] }
  | { type: 'addToDecree'; cards: AddToDecreeCard[] }
  | { type: 'newRoost'; clearing: ClearingId }
  | { type: 'turmoil' }
  | {
      type: 'decree'
      column: DecreeColumn
      cardId: string
      clearing?: ClearingId
      defender?: Seat
      moves?: MarchMove[]
    }
  | { type: 'revolt'; clearing: ClearingId; supporterIds: string[] }
  | { type: 'spreadSympathy'; clearing: ClearingId; supporterIds: string[] }
  | { type: 'mobilize'; cardId: string }
  | { type: 'train'; cardId: string }
  | {
      type: 'militaryOp'
      op: 'move' | 'battle' | 'recruit' | 'organize'
      from?: ClearingId
      to?: ClearingId
      count?: number
      clearing?: ClearingId
      defender?: Seat
    }
  | { type: 'slip'; to: ClearingId | `forest:${number}` }
  | {
      type: 'vbMove'
      to: ClearingId
      allySeat?: Seat
      allyCount?: number
    }
  | { type: 'vbBattle'; defender: Seat; alliedSeat?: Seat }
  | { type: 'explore' }
  | {
      type: 'quest'
      questId: string
      reward: 'vp' | 'draw'
    }
  | {
      type: 'aid'
      target: Seat
      cardId: string
      takeItem?: ItemType
    }
  | { type: 'strike'; defender: Seat; pieceId?: string }
  | { type: 'repair'; itemIndex: number }
  | { type: 'vbCraft'; cardId: string }
  | { type: 'steal'; target: Seat }
  | {
      type: 'vbRearrange'
      itemType: 'tea' | 'coin' | 'bag'
      from: 'track' | 'satchel'
    }
  | { type: 'takeDominance'; cardId: string }
  | {
      type: 'activateDominance'
      cardId: string
      coalitionTarget?: Seat
    }
  | { type: 'refresh' }
  | { type: 'rest' }
  | ResolveEventAction

export type ResolveEventAction = {
  type: 'resolveEvent'
  order?: Seat[]
  pieceIds?: string[]
  cardId?: string
  decline?: boolean
  useEffect?: boolean
  clearing?: ClearingId
  leader?: EyrieLeader
  /** Rule: Vagabond > Setup 2 — forest index on Fall map. */
  forest?: number
}

export type ActionSpec = {
  type: string
  actor: Seat
  params?: ActionChoiceParams
}

export type ActionResult = {
  state: import('#state/types.js').GameState
  log: import('#log/types.js').LogEntry[]
}
