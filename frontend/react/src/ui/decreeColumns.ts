import type { ActionSpec, GameState } from '#api/client.ts'
import { readChoiceParams } from '#game/resolution/ActionComposer.ts'
import { decreeCardSuit } from '#ui/ActionTray.ts'

export const DECREE_ACTION_TYPE = 'decree'
const EYRIE_FACTION = 'eyrie'
const DAYLIGHT_PHASE = 'daylight'
/** Daylight step that resolves the Decree (the craft step comes before it). */
const DECREE_STEP = 'decree'

/** True in the step that resolves the Decree: before it the columns only show. */
export function isDecreeStep(state: GameState | undefined): boolean {
  return state?.phase === DAYLIGHT_PHASE && state.step === DECREE_STEP
}
/** Decree columns, resolved left to right. Rule: Eyrie 7.5.2. */
export const DECREE_COLUMN_ORDER: readonly string[] = ['recruit', 'move', 'battle', 'build']

/** `done`: resolved. `now`: the column being resolved. `later`: still to come. */
export type DecreeColumnState = 'done' | 'now' | 'later'

/** One card of a Decree column, drawn as its suit. */
export type DecreeCardMark = {
  cardId: string
  suit: string | null
  isResolved: boolean
  /** The legal action that resolves this card; null when it cannot be now. */
  spec: ActionSpec | null
}

export type DecreeColumnView = {
  column: string
  state: DecreeColumnState
  cards: readonly DecreeCardMark[]
}

export type DecreeCard = { id: string }

function isDecreeCard(entry: unknown): entry is DecreeCard {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof Reflect.get(entry, 'id') === 'string'
  )
}

export function decreeCardsOfColumn(decree: object, column: string): DecreeCard[] {
  const cards: unknown = Reflect.get(decree, column)
  return Array.isArray(cards) ? cards.filter(isDecreeCard) : []
}

type DecreeProgress = {
  /** Column being resolved; null before the first card and after the last. */
  currentColumn: string | null
  remainingCardIds: ReadonlySet<string>
  isDecreeDone: boolean
}

function decreeProgress(state: GameState): DecreeProgress {
  const scratch = state.turnScratch
  const cursor: unknown =
    typeof scratch === 'object' && scratch !== null
      ? Reflect.get(scratch, 'decree')
      : null
  const isDecreeDone: boolean =
    typeof scratch === 'object' &&
    scratch !== null &&
    Reflect.get(scratch, 'decreeDone') === true
  if (typeof cursor !== 'object' || cursor === null) {
    return { currentColumn: null, remainingCardIds: new Set(), isDecreeDone }
  }
  const column: unknown = Reflect.get(cursor, 'column')
  const remaining: unknown = Reflect.get(cursor, 'remaining')
  return {
    currentColumn: typeof column === 'string' ? column : null,
    remainingCardIds: new Set(
      Array.isArray(remaining)
        ? remaining.filter((entry) => typeof entry === 'string')
        : [],
    ),
    isDecreeDone,
  }
}

function columnState(column: string, progress: DecreeProgress): DecreeColumnState {
  if (progress.isDecreeDone) {
    return 'done'
  }
  if (progress.currentColumn === null) {
    return 'later'
  }
  if (column === progress.currentColumn) {
    return 'now'
  }
  return DECREE_COLUMN_ORDER.indexOf(column) <
    DECREE_COLUMN_ORDER.indexOf(progress.currentColumn)
    ? 'done'
    : 'later'
}

/** Decree of the Eyrie sitting at this seat; null for any other faction. */
export function eyrieDecreeOf(state: GameState, seat: number): object | null {
  const player = state.players.find((entry) => entry.seat === seat)
  const board: unknown = player?.board
  if (
    player?.faction !== EYRIE_FACTION ||
    typeof board !== 'object' ||
    board === null
  ) {
    return null
  }
  const decree: unknown = Reflect.get(board, 'decree')
  return typeof decree === 'object' && decree !== null ? decree : null
}

/**
 * The four Decree columns of the Eyrie taking its Daylight, with what is
 * resolved and what can be resolved now. Null for any other seat or phase.
 */
export function decreeColumnViews(
  state: GameState | undefined,
  actorSeat: number,
  legalActions: readonly ActionSpec[],
): DecreeColumnView[] | null {
  if (state === undefined || state.phase !== DAYLIGHT_PHASE) {
    return null
  }
  const decree: object | null = eyrieDecreeOf(state, actorSeat)
  if (decree === null) {
    return null
  }
  const progress: DecreeProgress = decreeProgress(state)
  return DECREE_COLUMN_ORDER.map((column): DecreeColumnView => {
    const stateOfColumn: DecreeColumnState = columnState(column, progress)
    return {
      column,
      state: stateOfColumn,
      cards: decreeCardsOfColumn(decree, column).map(
        (card): DecreeCardMark => ({
          cardId: card.id,
          suit: decreeCardSuit(card.id, state),
          isResolved:
            stateOfColumn === 'done' ||
            (stateOfColumn === 'now' && !progress.remainingCardIds.has(card.id)),
          spec:
            legalActions.find(
              (legal) =>
                legal.type === DECREE_ACTION_TYPE &&
                legal.actor === actorSeat &&
                readChoiceParams(legal).cardIds?.includes(card.id) === true,
            ) ?? null,
        }),
      ),
    }
  })
}

/** Phase tab of an Eyrie Daylight: Decree cards resolved over all of them. */
export function decreeTally(columns: readonly DecreeColumnView[]): string {
  const cards: readonly DecreeCardMark[] = columns.flatMap(
    (column) => column.cards,
  )
  const resolved: number = cards.filter((card) => card.isResolved).length
  return `${String(resolved)}/${String(cards.length)}`
}

const BIRD_SUIT = 'bird'

/**
 * Next Decree card the column medallion resolves. Non-bird suits first so
 * the player need not pick a suit mark; bird stays available via its mark.
 */
export function nextResolvableDecreeSpec(
  cards: readonly DecreeCardMark[],
): ActionSpec | null {
  const resolvable: readonly DecreeCardMark[] = cards.filter(
    (card) => !card.isResolved && card.spec !== null,
  )
  const nonBird: DecreeCardMark | undefined = resolvable.find(
    (card) => card.suit !== BIRD_SUIT,
  )
  if (nonBird?.spec !== undefined && nonBird.spec !== null) {
    return nonBird.spec
  }
  const first: DecreeCardMark | undefined = resolvable[0]
  return first?.spec ?? null
}
