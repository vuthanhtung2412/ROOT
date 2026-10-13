import {
  FALL,
  describeLogEntry,
  formatGameView,
  type ActionSpec,
  type Game,
} from '@root/lib'
import { redactLegalActionsForViewer } from '#view/redactLegalActionsForViewer.js'
import {
  redactLogForViewer,
  type ViewerLogEntry,
} from '#view/redactLogForViewer.js'
import { redactStateForViewer } from '#view/redactStateForViewer.js'

const PATH_ENDPOINT_SEPARATOR = '-'
const LIST_SEPARATOR = ' '

function formatEdges(edges: readonly (readonly [number, number])[]): string {
  return edges
    .map(
      ([from, to]: readonly [number, number]): string =>
        `${String(from)}${PATH_ENDPOINT_SEPARATOR}${String(to)}`,
    )
    .join(LIST_SEPARATOR)
}

/** The game as one seat sees it at the table, as text. */
export function formatPlayerGameView(game: Game, playerId: string): string {
  const view = formatGameView(redactStateForViewer(game.state, playerId), {
    historyLength: game.history.length,
  })
  // The drawn map shows where clearings are; these lines say what connects.
  return [
    view,
    `paths (clearing-clearing): ${formatEdges(FALL.paths)}`,
    `rivers (clearing-clearing): ${formatEdges(FALL.rivers)}`,
  ].join('\n')
}

/** Latest `entryLimit` log lines as one seat may read them. */
export function formatPlayerLog(
  game: Game,
  playerId: string,
  entryLimit: number,
): string {
  const state = redactStateForViewer(game.state, playerId)
  return redactLogForViewer(game.log, game.state, playerId)
    .slice(-entryLimit)
    .map((entry: ViewerLogEntry): string =>
      entry.t === 'join'
        ? `JOIN (${entry.faction})`
        : describeLogEntry(entry, state),
    )
    .join('\n')
}

/** Legal actions the seat itself may send now. */
export function listPlayerLegalActions(
  game: Game,
  playerId: string,
): ActionSpec[] {
  return redactLegalActionsForViewer(game.legalActions(), game.state, playerId)
}
