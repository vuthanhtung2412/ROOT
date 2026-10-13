import {
  boardOf,
  buildColumn,
  buildVictoryPoints,
  canBuildAt,
  recruiterClearings,
} from '#factions/marquise/rules.js'
import {
  MARQUISE_BUILDINGS,
  type MarquiseBuilding,
} from '#factions/marquise/setup.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { unusedCraftingSuits } from '#queries/craft.js'
import { rules } from '#queries/ruler.js'
import { woodReachable } from '#queries/wood.js'
import { MARQUISE_BUILD_COST } from '#state/boards.js'
import type { GameState } from '#state/types.js'

export type MarquiseBuildingForecast = {
  building: MarquiseBuilding
  /** Buildings of this type still on the faction board. */
  leftOnBoard: number
  /** Wood the next one costs; null when none is left. Rule: 6.5.4.II. */
  woodCost: number | null
  /** Points the next one scores; null when none is left. Rule: 6.5.4.III. */
  victoryPoints: number | null
  /** Clearings where it can be built with the wood in reach now. */
  buildableIn: ClearingId[]
}

export type RuledClearingWood = {
  clearing: ClearingId
  /** Wood a build in this clearing can pay with. Rule: 6.5.4.II. */
  woodInReach: number
}

export type MarquiseForecast = {
  woodInSupply: number
  warriorsInSupply: number
  ruledClearings: RuledClearingWood[]
  buildings: MarquiseBuildingForecast[]
  /** Suit of every workshop not used to craft yet this turn. */
  unusedWorkshopSuits: Suit[]
  /** Clearings holding a recruiter. Rule: 6.5.3 — one warrior per recruiter. */
  recruiterClearings: ClearingId[]
}

function allClearings(): ClearingId[] {
  return FALL.clearings.map((_clearing, index: number): ClearingId => index)
}

/**
 * The Marquise economy as the map stands: wood in reach of each ruled
 * clearing, what the next building of each type costs and scores, and where
 * it can be built. Reads only.
 */
export function forecastMarquise(
  state: GameState,
  seat: Seat,
  ctx: Ctx,
): MarquiseForecast {
  const board = boardOf(state, seat)
  return {
    woodInSupply: board.supply.wood,
    warriorsInSupply: board.supply.warriors,
    ruledClearings: allClearings()
      .filter((clearing: ClearingId): boolean =>
        rules(state, clearing, seat, ctx.hooks),
      )
      .map(
        (clearing: ClearingId): RuledClearingWood => ({
          clearing,
          woodInReach: woodReachable(state, seat, clearing, ctx.hooks),
        }),
      ),
    buildings: MARQUISE_BUILDINGS.map(
      (building: MarquiseBuilding): MarquiseBuildingForecast => {
        const leftOnBoard = board.tracks[building].placed
        const column = buildColumn(leftOnBoard)
        return {
          building,
          leftOnBoard,
          woodCost: leftOnBoard < 1 ? null : (MARQUISE_BUILD_COST[column] ?? null),
          victoryPoints:
            leftOnBoard < 1 ? null : buildVictoryPoints(building, column),
          buildableIn: allClearings().filter((clearing: ClearingId): boolean =>
            canBuildAt(state, { seat, clearing, building }, ctx),
          ),
        }
      },
    ),
    unusedWorkshopSuits: unusedCraftingSuits(state, seat),
    recruiterClearings: recruiterClearings(state, seat),
  }
}
