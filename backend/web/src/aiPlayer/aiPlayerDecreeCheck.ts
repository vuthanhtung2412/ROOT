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
  'Columns resolve in order recruit, move, battle, build. Cards are checked against the map as it stands now, and again with the warriors the recruit column can add ("dependsOnRecruit"). Moves and battles of this turn are your choices and are not simulated: a card that needs them is listed as a risk.'

export type DecreeCheck = {
  leader: DecreeForecast['leader']
  columns: DecreeForecast['columns']
  /** Why the Decree would fall into turmoil. Empty: every card can resolve. */
  turmoilRisks: string[]
  /** Cards that resolve only if the recruit column places warriors for them. */
  dependsOnRecruit: string[]
  /** Rule: 7.7.1 — one victory point per bird card in the Decree. */
  victoryPointsLostInTurmoil: number
  note: string
}

/** True when warriors of the recruit column would let the card resolve. */
function opensAfterRecruit(card: DecreeCardForecast): boolean {
  return !card.resolvable && (card.whereAfterRecruit ?? []).length > 0
}

/** Cards that cannot resolve now but could once the recruit column has. */
function listRecruitDependentCards(forecast: DecreeForecast): string[] {
  return DECREE_COLUMNS.flatMap((column: DecreeColumn): string[] =>
    forecast.columns[column].filter(opensAfterRecruit).map(
      (card: DecreeCardForecast): string =>
        `${column}: ${card.name} (${card.suit}) cannot resolve now, but could in clearing ${(card.whereAfterRecruit ?? []).join(', ')} if you recruit there first`,
    ),
  )
}

function listTurmoilRisks(forecast: DecreeForecast): string[] {
  const unresolvable: string[] = DECREE_COLUMNS.flatMap(
    (column: DecreeColumn): string[] =>
      forecast.columns[column]
        .filter(
          (card: DecreeCardForecast): boolean =>
            !card.resolvable && !opensAfterRecruit(card),
        )
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
    dependsOnRecruit: listRecruitDependentCards(forecast),
    victoryPointsLostInTurmoil: forecast.birdCards,
    note: FORECAST_NOTE,
  }
}
