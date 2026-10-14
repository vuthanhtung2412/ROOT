import type { ActionOption } from '#actions/options.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { BuildingType, FactionId, ItemType, Seat } from '#pieces/types.js'
import type {
  DecreeColumn,
  EyrieLeader,
  VagabondCharacter,
} from '#state/boards.js'
import type { RiverfolkService } from '#state/riverfolkBoard.js'

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
  /** Wood cost of the leftmost building of this type. Rule: 6.5.4.II. */
  woodCost: number
  /** Reachable wood tokens as clearing ids (one entry per token). */
  availableWoodClearings: ClearingId[]
  /**
   * Greedy preselection: clearings with lowest
   * `ownRuleStrength − max(otherRuleStrength)` first.
   */
  suggestedWoodClearings: ClearingId[]
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

/** Rule: 9.2.6 — one undamaged Vagabond item, identified by type and face. */
export type VagabondItemChoice = {
  type: ItemType
  exhausted: boolean
  /** Set when the item sits in the Damaged box (item-limit removal only). */
  damaged?: boolean
}

/** Rule: 9.5.6 Aid — crafted items one target seat can hand over. */
export type AidTakeOption = {
  target: Seat
  itemTypes: ItemType[]
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
  options?:
    | OverworkChoice[]
    | BuildChoice[]
    | AddToDecreeCard[]
    | RevoltChoice[]
    | ActionOption[]
  /** Correlated battle / decree-battle targets. */
  targets?: BattleTargetChoice[]
  decline?: true[]
  pieceIds?: string[]
  order?: Seat[][]
  useEffect?: boolean[]
  column?: DecreeColumn[]
  leaders?: EyrieLeader[]
  /** Vagabond setup — characters to choose from. */
  characters?: VagabondCharacter[]
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
  /** Vagabond aid — item types that can be exhausted as the cost. */
  costItemTypes?: ItemType[]
  /** Vagabond aid — crafted item types each target can hand over. */
  aidTakeOptions?: AidTakeOption[]
  /** Vagabond item damage — undamaged items the player may choose from. */
  vagabondItems?: VagabondItemChoice[]
  /** Vagabond item damage — exact number of items to choose. */
  itemCount?: number[]
  /** Lizard Cult setup — suits the outcast marker may start on. */
  suits?: Suit[]
}

export type Action =
  /**
   * Take a seat. Open lobby: `faction` is the player's pick (joining again
   * changes it). Preset lobby: the seat's faction is already decided.
   */
  | { type: 'join'; playerId: string; faction?: FactionId }
  /** Open lobby: the player at `seat` loses it; later seats move down one. */
  | { type: 'expel'; seat: Seat }
  | { type: 'start' }
  | { type: 'birdsongWood' }
  | { type: 'eveningDraw' }
  | { type: 'emergencyOrders' }
  | { type: 'eveningScore' }
  | { type: 'endPhase' }
  | { type: 'spendBird'; cardId: string }
  | { type: 'recruit' }
  | { type: 'march'; moves: MarchMove[] }
  | {
      type: 'build'
      clearing: ClearingId
      building: BuildingType
      /** One clearing id per wood token spent; empty when cost is 0. */
      woodClearings: ClearingId[]
    }
  | { type: 'overwork'; clearing: ClearingId; cardId: string }
  | { type: 'craft'; cardId: string }
  | { type: 'battle'; clearing: ClearingId; defender: Seat }
  /** Take a random card from `target`; the card to give is a pending event. */
  | { type: 'swapMeet'; target: Seat }
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
      /** Enemy battled in the destination; absent when it holds no enemy. */
      defender?: Seat
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
  | { type: 'mobilize'; cardIds: string[] }
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
      /** Rule: 9.5.6 Aid — which item the Vagabond exhausts as the cost. */
      costItem?: ItemType
    }
  | { type: 'strike'; defender: Seat; pieceId?: string }
  | { type: 'repair'; itemIndex: number }
  | { type: 'vbCraft'; cardId: string }
  | { type: 'steal'; target: Seat }
  /** Rule: D.2.2 Day Labor — Tinker takes this card from the discard pile. */
  | { type: 'dayLabor'; cardId: string }
  /** Rule: D.3.2 Hideout — damaged items the Ranger repairs; ends Daylight. */
  | { type: 'hideout'; items: VagabondItemChoice[] }
  | {
      type: 'vbRearrange'
      itemType: 'tea' | 'coin' | 'bag'
      from: 'track' | 'satchel'
    }
  /** Rule: 9.6.4 Check Item Capacity — items the Vagabond removes from the game. */
  | { type: 'vbRemoveItems'; items: VagabondItemChoice[] }
  | { type: 'takeDominance'; cardId: string }
  | {
      type: 'activateDominance'
      cardId: string
      coalitionTarget?: Seat
    }
  | { type: 'refresh' }
  | { type: 'rest' }
  | LizardAction
  | RiverfolkAction
  | ResolveEventAction

/** Rule: 11.4–11.6 — Riverfolk Company turn actions. */
export type RiverfolkAction =
  /** Rule: 11.4 — Protectionism, Score Dividends, Gather Funds. */
  | { type: 'gatherFunds' }
  /** Rule: 11.5.1 Move — commit one fund (owned by `fundOwner`). */
  | {
      type: 'riverfolkMove'
      from: ClearingId
      to: ClearingId
      count: number
      fundOwner: Seat
    }
  /** Rule: 11.5.2 Battle — commit one fund. */
  | {
      type: 'riverfolkBattle'
      clearing: ClearingId
      defender: Seat
      fundOwner: Seat
    }
  /** Rule: 11.5.3 Craft — commit funds; `exportCard` takes the Export instead. */
  | { type: 'riverfolkCraft'; cardId: string; exportCard: boolean }
  /** Rule: 11.5.4 Draw — commit one fund. */
  | { type: 'riverfolkDraw'; fundOwner: Seat }
  /** Rule: 11.5.5 Recruit — spend one fund. */
  | { type: 'riverfolkRecruit'; clearing: ClearingId; fundOwner: Seat }
  /** Rule: 11.5.6 Establish Trade Post with Garrison — spend two ruler funds. */
  | { type: 'establishTradePost'; clearing: ClearingId }
  /** Rule: 11.6.2 Set Costs — the new cost of every service marker. */
  | {
      type: 'setServiceCosts'
      handCard: number
      riverboats: number
      mercenaries: number
    }

/** Rule: 10.4–10.6 — Lizard Cult turn actions. */
export type LizardAction =
  /** Rule: 10.4.1–10.4.2 — adjust the Outcast, then discard the Lost Souls. */
  | { type: 'adjustOutcast' }
  /** Rule: 10.4.3.I Crusade — battle in an Outcast clearing (or after a crusade move). */
  | { type: 'crusadeBattle'; clearing: ClearingId; defender: Seat }
  /** Rule: 10.4.3.I Crusade — move from an Outcast clearing. */
  | { type: 'crusadeMove'; from: ClearingId; to: ClearingId; count: number }
  /** Rule: 10.4.3.I Crusade — decline the battle offered after a crusade move. */
  | { type: 'skipCrusadeBattle' }
  /** Rule: 10.4.3.II Convert — replace an enemy warrior with a Cult warrior. */
  | { type: 'convert'; clearing: ClearingId; target: Seat }
  /** Rule: 10.4.3.III Sanctify — replace an enemy building with a garden. */
  | {
      type: 'sanctify'
      clearing: ClearingId
      target: Seat
      building: BuildingType
    }
  /** Rule: 10.5.1 Build — reveal a card, place a matching garden. */
  | { type: 'ritualBuild'; cardId: string; clearing: ClearingId }
  /** Rule: 10.5.2 Recruit — reveal a card, place a warrior. */
  | { type: 'ritualRecruit'; cardId: string; clearing: ClearingId }
  /** Rule: 10.5.3 Score — spend a card for Gardens track victory points. */
  | { type: 'ritualScore'; cardId: string }
  /** Rule: 10.5.4 Sacrifice — reveal a bird card, warrior to Acolytes. */
  | { type: 'ritualSacrifice'; cardId: string }
  /** Rule: 10.6.1 — return revealed cards to hand. */
  | { type: 'returnRevealed' }

export type ResolveEventAction = {
  type: 'resolveEvent'
  order?: Seat[]
  pieceIds?: string[]
  cardId?: string
  decline?: boolean
  useEffect?: boolean
  clearing?: ClearingId
  leader?: EyrieLeader
  /** Rule: Vagabond > Setup 1 — chosen character. */
  character?: VagabondCharacter
  /** Rule: Vagabond > Setup 2 — forest index on Fall map. */
  forest?: number
  /** Rule: 9.2.6 — undamaged items the Vagabond chooses to damage. */
  items?: VagabondItemChoice[]
  /** Rule: 10.3.3 — suit the Lizard Cult outcast marker starts on. */
  suit?: Suit
  /** Rule: 11.3.5 — starting cost of each Riverfolk service (all three together). */
  handCard?: number
  riverboats?: number
  mercenaries?: number
  /** Rule: 11.2.6 — Riverfolk service bought (`cardId` names the Hand Card). */
  service?: RiverfolkService
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
