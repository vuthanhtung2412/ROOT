import {
  describeAction,
  describeActionShape,
  type Action,
  type ActionSpec,
  type FactionId,
  type Game,
  type PlayerState,
} from '@root/lib'
import {
  formatPlayerLog,
  listPlayerLegalActions,
} from '#view/playerView.js'
import { redactStateForViewer } from '#view/redactStateForViewer.js'

const LOG_LINE_SEPARATOR = '\n'

/** A legal action with the exact fields `act` takes for its type. */
export type DescribedActionSpec = ActionSpec & {
  /** Fields of the action to send; "params" only lists the values to pick. */
  shape: string
}

/**
 * Param names are lists ("cardIds", "clearings") while the action often takes
 * one value ("cardId", "clearing"): the shape spells out the action itself.
 */
export function listDescribedLegalActions(
  game: Game,
  playerId: string,
): DescribedActionSpec[] {
  return listPlayerLegalActions(game, playerId).map(
    (spec: ActionSpec): DescribedActionSpec => ({
      ...spec,
      shape: describeSpecShape(spec),
    }),
  )
}

/** An answer to a pending event: every field optional, a few on offer. */
const PENDING_ANSWER_TYPE = 'resolveEvent'
const PLURAL_SUFFIX = 's'
/** Params whose action field is not the param name or its singular. */
const PARAM_FIELD_ALIASES: Readonly<Record<string, string>> = {
  vagabondItems: 'items',
}

/** Action fields the params of a spec let the player fill. */
function offeredFieldsOf(spec: ActionSpec): string[] {
  return Object.entries(spec.params ?? {}).flatMap(
    ([paramName, values]: [string, readonly object[] | readonly unknown[]]): string[] => {
      const elementFields: string[] = values.flatMap(
        (value: unknown): string[] =>
          typeof value === 'object' && value !== null && !Array.isArray(value)
            ? Object.keys(value)
            : [],
      )
      return [
        paramName,
        paramName.endsWith(PLURAL_SUFFIX)
          ? paramName.slice(0, -PLURAL_SUFFIX.length)
          : paramName,
        ...(paramName in PARAM_FIELD_ALIASES
          ? [PARAM_FIELD_ALIASES[paramName] ?? paramName]
          : []),
        ...elementFields,
      ]
    },
  )
}

function describeSpecShape(spec: ActionSpec): string {
  const fullShape: string =
    describeActionShape(spec.type) ?? `{type: "${spec.type}"}`
  if (spec.type !== PENDING_ANSWER_TYPE) return fullShape
  const offeredShape: string | null = describeActionShape(
    spec.type,
    offeredFieldsOf(spec),
  )
  // Nothing matched: the whole shape is safer than an empty one.
  return offeredShape === null || offeredShape === `{type: "${spec.type}"}`
    ? fullShape
    : offeredShape
}

/** Where the game stands for one seat right after an action. */
export type ActionReport = {
  /** The action, in the words of the game log. */
  applied: string
  /** Everything the action caused, oldest first. */
  log: string[]
  /** `<phase>/<step>` of the turn in progress. */
  phase: string
  yourTurn: boolean
  /** What the seat may do next. Empty: its part is done for now. */
  legalActions: DescribedActionSpec[]
  /** Factions that must act before the game moves on, when the seat cannot. */
  waitingFor?: FactionId[]
}

export type ActionReportRequest = {
  /** The game after the action. */
  game: Game
  playerId: string
  action: Action
  /** How many log entries the action wrote. */
  logEntryCount: number
}

function factionsToAct(game: Game): FactionId[] {
  const actorSeats = new Set<number>(
    game.legalActions().map((spec: ActionSpec): number => spec.actor),
  )
  return game.state.players
    .filter((player: PlayerState): boolean => actorSeats.has(player.seat))
    .map((player: PlayerState): FactionId => player.faction)
}

/**
 * What `act` answers: the change and the next legal actions in one reply, so
 * the model does not spend a call on `actions` after every move.
 */
export function buildActionReport(request: ActionReportRequest): ActionReport {
  const { game, playerId, action, logEntryCount } = request
  const state = redactStateForViewer(game.state, playerId)
  const seat: number | undefined = state.players.find(
    (player: PlayerState): boolean => player.playerId === playerId,
  )?.seat
  const legalActions = listDescribedLegalActions(game, playerId)
  const report: ActionReport = {
    applied: describeAction(action, state),
    log:
      logEntryCount === 0
        ? []
        : formatPlayerLog(game, playerId, logEntryCount).split(
            LOG_LINE_SEPARATOR,
          ),
    phase: `${state.phase}/${state.step}`,
    yourTurn: state.currentSeat === seat,
    legalActions,
  }
  return legalActions.length > 0
    ? report
    : { ...report, waitingFor: factionsToAct(game) }
}
