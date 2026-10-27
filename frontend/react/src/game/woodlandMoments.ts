import type { GameState } from '#api/client.ts'
import {
  isEyrieLeaderId,
  type EyrieLeaderId,
} from '#assets/eyrieLeaderCatalog.ts'
import { fallClearingSuit } from '#game/boardLayout.ts'
import {
  numberField,
  readLoggedAction,
  readLoggedEvent,
  readLoggedVictoryPoints,
  type LoggedAction,
} from '#game/momentLogEntries.ts'
import {
  EYRIE_DECREE_COLUMNS,
  suitForDecreeCard,
  type EyrieDecreeColumnId,
} from '#ui/factionBoardViewModel.ts'

/**
 * Big turns of the game told to every player over the whole screen: a banner
 * and a short show of what happened, read from one server update.
 */

/** A Vagabond took the item under a ruin. Rule: 9.5.3. */
export type ExploreMoment = {
  kind: 'explore'
  seat: number
  faction: string
}

/** The Woodland Alliance revolted. Rule: 8.4.1. */
export type RevoltMoment = {
  kind: 'revolt'
  seat: number
  faction: string
  /** Suit of the clearing that rose up; null off the Fall map. */
  suit: string | null
}

export type TurmoilDecreeCard = {
  suit: string
  isVizier: boolean
  /** The decree could not carry this card out. */
  failed: boolean
}

export type TurmoilDecreeColumn = {
  columnId: EyrieDecreeColumnId
  cards: readonly TurmoilDecreeCard[]
}

/** The Eyrie fell into turmoil. Rule: 7.7. */
export type TurmoilMoment = {
  kind: 'turmoil'
  seat: number
  faction: string
  /** The decree as it stood; empty for a bot (its decree has suit columns). */
  decree: readonly TurmoilDecreeColumn[]
  /** The first card the decree could not carry out; null when unknown. */
  failedCard: { columnId: EyrieDecreeColumnId; suit: string } | null
  /** Victory points lost to Humiliate (0 or more). Rule: 7.7.1. */
  humiliateLoss: number
  /** The leader turned face down; null for a bot. Rule: 7.7.3. */
  deposedLeader: EyrieLeaderId | null
}

/** The Eyrie chose a leader, after turmoil or at setup. Rule: 7.7.3. */
export type LeaderPickMoment = {
  kind: 'leaderPick'
  seat: number
  faction: string
  chosen: EyrieLeaderId
  /** Leaders that could not be chosen (deposed earlier). */
  faceDown: readonly EyrieLeaderId[]
  /** Columns the Loyal Viziers of the new leader went to. */
  vizierColumns: readonly EyrieDecreeColumnId[]
}

export type WoodlandMoment =
  | ExploreMoment
  | RevoltMoment
  | TurmoilMoment
  | LeaderPickMoment

/** One server update worth of moments; `sequence` grows with every batch. */
export type WoodlandMomentBatch = {
  sequence: number
  moments: readonly WoodlandMoment[]
}

export const EMPTY_WOODLAND_MOMENT_BATCH: WoodlandMomentBatch = {
  sequence: 0,
  moments: [],
}

const EXPLORE_ACTION_TYPE = 'explore'
const BOT_EXPLORE_ACTION_TYPE = 'botExplore'
const REVOLT_ACTION_TYPE = 'revolt'
const BOT_REVOLT_ACTION_TYPE = 'botRevolt'
const TURMOIL_ACTION_TYPE = 'turmoil'
const BOT_TURMOIL_ACTION_TYPE = 'botTurmoil'
const CHOOSE_LEADER_EVENT_TYPE = 'chooseLeader'
const HUMILIATE_REASON = 'turmoil humiliate'
const VIZIER_DEFINITION_ID = 'VIZIER'
const EYRIE_BOARD_KIND = 'eyrie'

type DecreeCard = { id: string; defId: string }

/** The part of an Eyrie board the moments are read from. */
type EyrieBoard = {
  leader: EyrieLeaderId | null
  leadersFaceDown: readonly EyrieLeaderId[]
  decree: Readonly<Record<EyrieDecreeColumnId, readonly DecreeCard[]>>
}

function isDecreeCard(value: unknown): value is DecreeCard {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'defId') === 'string'
  )
}

function readDecreeCards(decree: object, columnId: string): DecreeCard[] {
  const cards: unknown = Reflect.get(decree, columnId)
  return Array.isArray(cards) ? cards.filter(isDecreeCard) : []
}

function readLeaders(board: object, field: string): EyrieLeaderId[] {
  const leaders: unknown = Reflect.get(board, field)
  if (!Array.isArray(leaders)) return []
  return leaders.filter(
    (leader: unknown): leader is EyrieLeaderId =>
      typeof leader === 'string' && isEyrieLeaderId(leader),
  )
}

function readEyrieBoard(board: unknown): EyrieBoard | null {
  if (typeof board !== 'object' || board === null) return null
  if (Reflect.get(board, 'kind') !== EYRIE_BOARD_KIND) return null
  const decree: unknown = Reflect.get(board, 'decree')
  if (typeof decree !== 'object' || decree === null) return null
  const leader: unknown = Reflect.get(board, 'leader')
  return {
    leader:
      typeof leader === 'string' && isEyrieLeaderId(leader) ? leader : null,
    leadersFaceDown: readLeaders(board, 'leadersFaceDown'),
    decree: {
      recruit: readDecreeCards(decree, 'recruit'),
      move: readDecreeCards(decree, 'move'),
      battle: readDecreeCards(decree, 'battle'),
      build: readDecreeCards(decree, 'build'),
    },
  }
}

type SeatPlayer = GameState['players'][number]

function playerAt(state: GameState, seat: number): SeatPlayer | undefined {
  return state.players.find((player: SeatPlayer): boolean => player.seat === seat)
}

function eyrieBoardAt(state: GameState, seat: number): EyrieBoard | null {
  return readEyrieBoard(playerAt(state, seat)?.board)
}

function factionAt(state: GameState, seat: number): string {
  return playerAt(state, seat)?.faction ?? ''
}

function isDecreeColumnId(value: unknown): value is EyrieDecreeColumnId {
  return EYRIE_DECREE_COLUMNS.some(
    (columnId: EyrieDecreeColumnId): boolean => columnId === value,
  )
}

type DecreeCursor = {
  columnId: EyrieDecreeColumnId
  remainingCardIds: ReadonlySet<string>
}

/**
 * The decree column being carried out and its cards still to do. Turmoil
 * strikes on the first column not done yet when no cursor was opened.
 */
function decreeCursor(state: GameState, board: EyrieBoard): DecreeCursor | null {
  const turnScratch: unknown = state.turnScratch
  const cursor: unknown =
    typeof turnScratch === 'object' && turnScratch !== null
      ? Reflect.get(turnScratch, 'decree')
      : null
  if (typeof cursor === 'object' && cursor !== null) {
    const columnId: unknown = Reflect.get(cursor, 'column')
    const remaining: unknown = Reflect.get(cursor, 'remaining')
    if (isDecreeColumnId(columnId) && Array.isArray(remaining)) {
      return {
        columnId,
        remainingCardIds: new Set<string>(
          remaining.filter(
            (cardId: unknown): cardId is string => typeof cardId === 'string',
          ),
        ),
      }
    }
  }
  const firstColumn: EyrieDecreeColumnId | undefined = EYRIE_DECREE_COLUMNS.find(
    (columnId: EyrieDecreeColumnId): boolean =>
      board.decree[columnId].length > 0,
  )
  return firstColumn === undefined
    ? null
    : {
        columnId: firstColumn,
        remainingCardIds: new Set<string>(
          board.decree[firstColumn].map((card: DecreeCard): string => card.id),
        ),
      }
}

function turmoilDecree(
  board: EyrieBoard,
  cursor: DecreeCursor | null,
): TurmoilDecreeColumn[] {
  return EYRIE_DECREE_COLUMNS.map(
    (columnId: EyrieDecreeColumnId): TurmoilDecreeColumn => ({
      columnId,
      cards: board.decree[columnId].map(
        (card: DecreeCard): TurmoilDecreeCard => ({
          suit: suitForDecreeCard(card.defId),
          isVizier: card.defId === VIZIER_DEFINITION_ID,
          failed:
            cursor !== null &&
            cursor.columnId === columnId &&
            cursor.remainingCardIds.has(card.id),
        }),
      ),
    }),
  )
}

function firstFailedCard(
  decree: readonly TurmoilDecreeColumn[],
): TurmoilMoment['failedCard'] {
  for (const column of decree) {
    const failed: TurmoilDecreeCard | undefined = column.cards.find(
      (card: TurmoilDecreeCard): boolean => card.failed,
    )
    if (failed !== undefined) {
      return { columnId: column.columnId, suit: failed.suit }
    }
  }
  return null
}

function humiliateLossOf(
  newLogEntries: readonly unknown[],
  seat: number,
): number {
  return newLogEntries.reduce((loss: number, entry: unknown): number => {
    const victoryPoints = readLoggedVictoryPoints(entry)
    return victoryPoints !== null &&
      victoryPoints.actor === seat &&
      victoryPoints.reason === HUMILIATE_REASON
      ? loss - victoryPoints.delta
      : loss
  }, 0)
}

type UpdateStates = {
  previous: GameState
  next: GameState
  newLogEntries: readonly unknown[]
}

function turmoilMoment(
  states: UpdateStates,
  logged: LoggedAction,
): TurmoilMoment {
  const seat: number = logged.actor
  const board: EyrieBoard | null =
    logged.actionType === TURMOIL_ACTION_TYPE
      ? eyrieBoardAt(states.previous, seat)
      : null
  const decree: TurmoilDecreeColumn[] =
    board === null
      ? []
      : turmoilDecree(board, decreeCursor(states.previous, board))
  return {
    kind: 'turmoil',
    seat,
    faction: factionAt(states.previous, seat),
    decree,
    failedCard: firstFailedCard(decree),
    humiliateLoss: humiliateLossOf(states.newLogEntries, seat),
    deposedLeader: board?.leader ?? null,
  }
}

function leaderPickMoment(
  states: UpdateStates,
  event: object,
): LeaderPickMoment | null {
  const seat: number | null = numberField(event, 'seat')
  if (seat === null) return null
  const after: EyrieBoard | null = eyrieBoardAt(states.next, seat)
  if (after === null || after.leader === null) return null
  return {
    kind: 'leaderPick',
    seat,
    faction: factionAt(states.next, seat),
    chosen: after.leader,
    faceDown: after.leadersFaceDown,
    vizierColumns: EYRIE_DECREE_COLUMNS.flatMap(
      (columnId: EyrieDecreeColumnId): EyrieDecreeColumnId[] =>
        after.decree[columnId]
          .filter((card: DecreeCard): boolean => card.defId === VIZIER_DEFINITION_ID)
          .map((): EyrieDecreeColumnId => columnId),
    ),
  }
}

function actionMoment(
  states: UpdateStates,
  logged: LoggedAction,
): WoodlandMoment | null {
  const seat: number = logged.actor
  if (
    logged.actionType === EXPLORE_ACTION_TYPE ||
    logged.actionType === BOT_EXPLORE_ACTION_TYPE
  ) {
    return { kind: 'explore', seat, faction: factionAt(states.previous, seat) }
  }
  if (
    logged.actionType === REVOLT_ACTION_TYPE ||
    logged.actionType === BOT_REVOLT_ACTION_TYPE
  ) {
    const clearing: number | null = numberField(logged.action, 'clearing')
    return {
      kind: 'revolt',
      seat,
      faction: factionAt(states.previous, seat),
      suit: clearing === null ? null : fallClearingSuit(clearing),
    }
  }
  if (
    logged.actionType === TURMOIL_ACTION_TYPE ||
    logged.actionType === BOT_TURMOIL_ACTION_TYPE
  ) {
    return turmoilMoment(states, logged)
  }
  return null
}

function entryMoment(
  states: UpdateStates,
  entry: unknown,
): WoodlandMoment | null {
  const logged: LoggedAction | null = readLoggedAction(entry)
  if (logged !== null) {
    return actionMoment(states, logged)
  }
  const event = readLoggedEvent(entry)
  return event !== null && event.eventType === CHOOSE_LEADER_EVENT_TYPE
    ? leaderPickMoment(states, event.event)
    : null
}

/**
 * Moments of one server update, in log order. None for the first state seen
 * or another game.
 */
export function woodlandMomentsBetween(
  previous: GameState | null,
  next: GameState,
  newLogEntries: readonly unknown[],
): WoodlandMoment[] {
  if (previous === null || previous.id !== next.id) return []
  const states: UpdateStates = { previous, next, newLogEntries }
  return newLogEntries.flatMap((entry: unknown): WoodlandMoment[] => {
    const moment: WoodlandMoment | null = entryMoment(states, entry)
    return moment === null ? [] : [moment]
  })
}
