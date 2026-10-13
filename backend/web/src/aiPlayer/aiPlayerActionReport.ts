import {
  describeAction,
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
  legalActions: ActionSpec[]
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
  const legalActions = listPlayerLegalActions(game, playerId)
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
