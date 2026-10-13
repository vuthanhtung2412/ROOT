import type { AddToDecreeCard } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import type { Card, CardSuit } from '#cards/types.js'
import {
  battleLegal,
  buildLegal,
  recruitLegal,
  recruitWarriorCount,
} from '#factions/eyrie/decree.js'
import { boardOf, cardMatchesClearing } from '#factions/eyrie/rules.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { enemySeatsInClearing } from '#queries/enemySeats.js'
import { canMove } from '#queries/move.js'
import { warriors } from '#queries/pieces.js'
import { playerOf } from '#queries/seat.js'
import { RuleError } from '#rules/RuleError.js'
import {
  DECREE_COLUMNS,
  type DecreeColumn,
  type EyrieLeader,
} from '#state/boards.js'
import type { GameState } from '#state/types.js'

const BIRD_SUIT: CardSuit = 'bird'

export type DecreeCardForecast = {
  cardId: string
  name: string
  suit: CardSuit
  /** True when the card could be resolved on the map as it stands. */
  resolvable: boolean
  /** Clearings to recruit, build or battle in; for a move, to move from. */
  where: ClearingId[]
  /** True for a hand card tried out, not yet in the Decree. */
  adding: boolean
  /**
   * Only on a card that cannot resolve now: where it could resolve once the
   * recruit column (resolved first) has placed warriors. Rule: 7.5.2.
   */
  whereAfterRecruit?: ClearingId[]
}

export type DecreeForecast = {
  leader: EyrieLeader | null
  columns: Record<DecreeColumn, DecreeCardForecast[]>
  /** Rule: 7.7.1 Humiliate — victory points lost in turmoil. */
  birdCards: number
  supplyWarriors: number
  /** Warriors the whole recruit column places. Rule: 7.5.2.I. */
  recruitWarriorsNeeded: number
}

export type DecreeForecastRequest = {
  seat: Seat
  /** Hand cards to try in a column before adding them. */
  adding: readonly AddToDecreeCard[]
}

type ColumnCard = {
  seat: Seat
  column: DecreeColumn
  card: Card
}

function allClearings(): ClearingId[] {
  return FALL.clearings.map((_clearing, index: number): ClearingId => index)
}

function clearingsToResolveIn(
  state: GameState,
  columnCard: ColumnCard,
  ctx: Ctx,
): ClearingId[] {
  const { seat, column, card } = columnCard
  return allClearings().filter((clearing: ClearingId): boolean => {
    switch (column) {
      case 'recruit':
        return recruitLegal(state, seat, card, clearing)
      case 'move':
        return (
          cardMatchesClearing(card, clearing) &&
          warriors(state, clearing, seat) > 0 &&
          allClearings().some((to: ClearingId): boolean =>
            canMove(state, { seat, from: clearing, to }, ctx.hooks),
          )
        )
      case 'battle':
        return enemySeatsInClearing(state, clearing, seat).some(
          (defender: Seat): boolean =>
            battleLegal(state, { seat, card, clearing, defender }),
        )
      case 'build':
        return buildLegal(state, { seat, card, clearing }, ctx)
    }
  })
}

/**
 * The map once the recruit column has resolved, at its most generous: one
 * new warrior in every clearing a recruit card may choose. A copy: `state`
 * is not changed. Null when no recruit card can resolve.
 */
function withRecruitedWarriors(
  state: GameState,
  seat: Seat,
  recruitColumn: readonly DecreeCardForecast[],
): GameState | null {
  const recruitClearings = new Set<ClearingId>(
    recruitColumn.flatMap(
      (forecast: DecreeCardForecast): ClearingId[] => forecast.where,
    ),
  )
  if (recruitClearings.size === 0) return null
  return {
    ...state,
    clearings: state.clearings.map((clearing, clearingId: number) =>
      recruitClearings.has(clearingId)
        ? {
            ...clearing,
            pieces: [
              ...clearing.pieces,
              {
                id: `forecast-warrior-${clearingId}`,
                kind: 'warrior' as const,
                owner: seat,
              },
            ],
          }
        : clearing,
    ),
  }
}

/**
 * Which Decree cards the Eyrie seat could resolve on the map as it stands
 * now, with `adding` tried in. Reads only: the Decree itself is not changed.
 * The map changes while a Decree resolves, so this is a forecast, not a proof.
 */
export function forecastDecree(
  state: GameState,
  request: DecreeForecastRequest,
  ctx: Ctx,
): DecreeForecast {
  const { seat, adding } = request
  const board = boardOf(state, seat)
  const hand = playerOf(state, seat).hand
  const forecastColumn = (
    column: DecreeColumn,
    afterRecruit: GameState | null,
  ): DecreeCardForecast[] => {
    const addedCards: Card[] = adding
      .filter((entry: AddToDecreeCard): boolean => entry.column === column)
      .map((entry: AddToDecreeCard): Card => {
        const card = hand.find(
          (handCard: Card): boolean => handCard.id === entry.cardId,
        )
        if (card === undefined) {
          throw new RuleError('CARD_NOT_IN_HAND', { cardId: entry.cardId })
        }
        return card
      })
    return [...board.decree[column], ...addedCards].map(
      (card: Card): DecreeCardForecast => {
        const where = clearingsToResolveIn(state, { seat, column, card }, ctx)
        const forecast: DecreeCardForecast = {
          cardId: card.id,
          name: defOf(card).name,
          suit: defOf(card).suit,
          resolvable: where.length > 0,
          where,
          adding: addedCards.includes(card),
        }
        if (where.length > 0 || afterRecruit === null) return forecast
        return {
          ...forecast,
          whereAfterRecruit: clearingsToResolveIn(
            afterRecruit,
            { seat, column, card },
            ctx,
          ),
        }
      },
    )
  }
  // The recruit column resolves first: its warriors may open later columns.
  const recruit = forecastColumn('recruit', null)
  const afterRecruit = withRecruitedWarriors(state, seat, recruit)
  const columns: Record<DecreeColumn, DecreeCardForecast[]> = {
    recruit,
    move: forecastColumn('move', afterRecruit),
    battle: forecastColumn('battle', afterRecruit),
    build: forecastColumn('build', afterRecruit),
  }
  return {
    leader: board.leader,
    columns,
    birdCards: DECREE_COLUMNS.flatMap(
      (column: DecreeColumn): DecreeCardForecast[] => columns[column],
    ).filter(
      (forecast: DecreeCardForecast): boolean => forecast.suit === BIRD_SUIT,
    ).length,
    supplyWarriors: board.supply.warriors,
    recruitWarriorsNeeded:
      columns.recruit.length * recruitWarriorCount(state, seat),
  }
}
