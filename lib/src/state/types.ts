import type { DeckState } from '../cards/Deck.js'
import type { Card } from '../cards/types.js'
import type { Event } from '../events/types.js'
import type { FactionId, ItemType, Piece, Seat } from '../pieces/types.js'
import type { DecreeColumn, FactionBoard } from './boards.js'

export type Phase = 'birdsong' | 'daylight' | 'evening'

export type Step = string

export type GameStatus = 'waiting' | 'playing' | 'finished'

export type ClearingState = {
  pieces: Piece[]
  ruin?: { items: ItemType[] }
}

export type PlayerState = {
  playerId: string
  seat: Seat
  faction: FactionId
  vp: number
  hand: Card[]
  playArea: Card[]
  craftedItems: ItemType[]
  board: FactionBoard
}

export type DecreeCursor = {
  column: DecreeColumn
  remaining: string[]
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
  itemSupply: Record<ItemType, number>
  pending: Event[]
  winner?: Seat
  turnScratch: {
    actionsLeft: number
    extraActions: number
    recruited: boolean
    birdsongWoodDone: boolean
    eveningDrawDone: boolean
    swapMeetUsed: boolean
    emergencyOrdersDone: boolean
    eveningScoreDone: boolean
    /** Decree cursor for current column; null until ensure or after column done. */
    decree: DecreeCursor | null
    /**
     * True after all decree columns resolved once this turn (viziers stay on board,
     so we must not re-open leftmost column). Rule: 7.5.2.
     */
    decreeDone: boolean
  }
}
