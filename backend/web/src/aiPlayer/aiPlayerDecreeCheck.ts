import {
  DECREE_COLUMNS,
  type AddToDecreeCard,
  type DecreeCardForecast,
  type DecreeColumn,
  type DecreeForecast,
  type Game,
  type PlayerState,
} from '@root/lib'

const EYRIE_FACTION = 'eyrie'
const FORECAST_NOTE =
  'Checked against the map as it stands now. Each card is checked on its own: the map changes while the Decree resolves (recruits add warriors, moves and battles shift them), and columns resolve in order recruit, move, battle, build.'

export type DecreeCheck = {
  leader: DecreeForecast['leader']
  columns: DecreeForecast['columns']
  /** Why the Decree would fall into turmoil. Empty: every card can resolve. */
  turmoilRisks: string[]
  /** Rule: 7.7.1 — one victory point per bird card in the Decree. */
  victoryPointsLostInTurmoil: number
  note: string
}

function listTurmoilRisks(forecast: DecreeForecast): string[] {
  const unresolvable: string[] = DECREE_COLUMNS.flatMap(
    (column: DecreeColumn): string[] =>
      forecast.columns[column]
        .filter((card: DecreeCardForecast): boolean => !card.resolvable)
        .map(
          (card: DecreeCardForecast): string =>
            `${column}: ${card.name} (${card.suit}) has no clearing to resolve in`,
        ),
  )
  if (forecast.recruitWarriorsNeeded <= forecast.supplyWarriors) {
    return unresolvable
  }
  return [
    ...unresolvable,
    `recruit: the column places ${String(forecast.recruitWarriorsNeeded)} warriors, your supply holds ${String(forecast.supplyWarriors)}`,
  ]
}

/**
 * The Decree of the seat, card by card, with what would send it into turmoil.
 * Returns null when the seat is not the Eyrie. `adding` must be hand cards.
 */
export function checkDecree(
  game: Game,
  playerId: string,
  adding: readonly AddToDecreeCard[],
): DecreeCheck | null {
  const viewer = game.state.players.find(
    (player: PlayerState): boolean => player.playerId === playerId,
  )
  if (viewer === undefined || viewer.faction !== EYRIE_FACTION) return null
  const forecast = game.forecastDecree({ seat: viewer.seat, adding })
  return {
    leader: forecast.leader,
    columns: forecast.columns,
    turmoilRisks: listTurmoilRisks(forecast),
    victoryPointsLostInTurmoil: forecast.birdCards,
    note: FORECAST_NOTE,
  }
}
