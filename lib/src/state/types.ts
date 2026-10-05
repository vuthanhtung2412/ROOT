import type { DeckState } from '#cards/Deck.js'
import type { QuestCard } from '#cards/quests.js'
import type { Card } from '#cards/types.js'
import type { Event } from '#events/types.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { FactionId, ItemType, Piece, Seat } from '#pieces/types.js'
import type { DecreeColumn, FactionBoard } from '#state/boards.js'

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
}
