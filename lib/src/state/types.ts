import type { DeckState } from '#cards/Deck.js'
import type { QuestCard } from '#cards/quests.js'
import type { Card } from '#cards/types.js'
import type { Event } from '#events/types.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { FactionId, ItemType, Piece, Seat } from '#pieces/types.js'
import type { DecreeColumn, FactionBoard } from '#state/boards.js'
import type { BotPlan } from '#state/botTurn.js'
import type { BotSettingsByFaction } from '#public/botSettings.js'

export type Phase = 'birdsong' | 'daylight' | 'evening'

export type Step = string

export type GameStatus = 'waiting' | 'setup' | 'playing' | 'finished'

export type ClearingState = {
  pieces: Piece[]
  ruin?: { items: ItemType[] }
}

export type PlayerState = {
  playerId: string
  seat: Seat
  faction: FactionId
  vp: number
  /** False after activating dominance / forming coalition. Rule: Dominance 3.3.1. */
  scoresVictoryPoints: boolean
  hand: Card[]
  playArea: Card[]
  /** Activated dominance card in play area (non-null = alt win / coalition). */
  activatedDominance: Card | null
  /** Vagabond coalition partner seat. Rule: Vagabond 9.2.8. */
  coalitionWith: Seat | null
  craftedItems: CraftedItem[]
  board: FactionBoard
}

export type CraftedItem = {
  type: ItemType
  exhausted: boolean
}

export type DecreeCursor = {
  column: DecreeColumn
  remaining: string[]
}

export type TurnScratch = {
  actionsLeft: number
  extraActions: number
  recruited: boolean
  birdsongWoodDone: boolean
  eveningDrawDone: boolean
  swapMeetUsed: boolean
  charmOffensiveUsed: boolean
  leagueUsed: boolean
  propagandaUsed: boolean
  saboteursUsed: boolean
  falseOrdersUsed: boolean
  eyrieEmigreCompleted: boolean
  /**
   * The current player already took an action in this phase, so "at the start
   * of Birdsong / Evening" effects (Saboteurs, Charm Offensive) are over.
   */
  phaseActionTaken: boolean
  /**
   * The current player ended Birdsong; only "at end of Birdsong" effects
   * (Eyrie Émigré) are left before Daylight.
   */
  endOfBirdsong: boolean
  emergencyOrdersDone: boolean
  eveningScoreDone: boolean
  decree: DecreeCursor | null
  decreeDone: boolean
  /** Alliance Evening — military ops remaining (≤ officers). */
  militaryOpsLeft: number
  /** Sympathy token piece ids activated for craft this turn. */
  sympathyCraftedIds: string[]
  /** Vagabond Birdsong — slip already used this turn. */
  slipDone: boolean
  /** Vagabond — aid counts toward relationship this turn per seat. */
  aidsThisTurn: Partial<Record<Seat, number>>
  /** Lizard Cult Birdsong — Outcast adjusted and Lost Souls discarded. */
  outcastAdjusted: boolean
  /** Lizard Cult — suits already scored by ritual this turn. Rule: 10.5.3. */
  ritualScoredSuits: Suit[]
  /** Lizard Cult — clearing where a crusade move may end in a free battle. */
  crusadeFollowUpClearing: ClearingId | null
  /** Riverfolk Birdsong — Protectionism, dividends and gathering done. */
  fundsGathered: boolean
  /** Riverboats bought this turn: rivers are paths. Rule: 11.2.7.II. */
  riverboats: boolean
  /** Mercenaries bought this turn. Rule: 11.2.7.III. */
  mercenaries: boolean
  /** Bot — tasks left in the current step (Rootbotics 4–5). Null: not planned yet. */
  botPlan?: BotPlan | null
  /** Mechanical Marquise — placed a building this turn (Expand 4.5.5). */
  botBuiltThisTurn?: boolean
  /** Mechanical Marquise — Expands taken this turn (house-rule cap). */
  botExpandCount?: number
}

export type GameState = {
  id: string
  seed: number
  map: 'fall'
  status: GameStatus
  turn: number
  currentSeat: Seat
  phase: Phase
  step: Step
  factions: FactionId[]
  /**
   * The game was created with no faction set: each player picks an untaken
   * faction when joining, and `factions` grows seat by seat.
   */
  openLobby?: true
  /** Rule: Rootbotics 3.3 — difficulty and traits per bot; absent = default, none. */
  botSettings?: BotSettingsByFaction
  players: PlayerState[]
  clearings: ClearingState[]
  deck: DeckState
  dominanceAvailable: Card[]
  /** Shared Vagabond quest draw pile. Rule: Vagabond > Setup 3; Share Quests 9.7.2. */
  questDeck: QuestCard[]
  /** Face-up quests near the map (3 after setup). */
  questsAvailable: QuestCard[]
  itemSupply: Record<ItemType, number>
  pending: Event[]
  /** Seat that won (VP / dominance). */
  winner?: Seat
  /** Vagabond seats in coalition with `winner`. Rule: Vagabond 9.2.8. */
  coWinners?: Seat[]
  turnScratch: TurnScratch
  /**
   * Latest actions the player whose turn it is may take back. Starts again
   * from zero after a battle, when the turn ends, when another player is
   * prompted, and when an action reveals hidden information (dice, a draw,
   * a change to another player's hand). Absent = none.
   */
  undoableActions?: number
}
