import type { CardSuit } from '#cards/types.js'
import { mechanicalMarquiseBoardOf } from '#factions/bots/botBoards.js'
import {
  MECHANICAL_MARQUISE_BUILDINGS,
  type MechanicalMarquiseBuilding,
} from '#factions/bots/mechanicalMarquise/setup.js'
import { ruledClearings } from '#factions/bots/botQueries.js'
import { byHighestPriority, byMost, inTargetOrder } from '#factions/bots/priority.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { ClearingId, Suit } from '#map/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { canPlace } from '#queries/place.js'
import { piecesIn, warriors } from '#queries/pieces.js'
import { openSlots } from '#queries/slots.js'
import { placeUpTo } from '#rules/place.js'
import { MECHANICAL_MARQUISE_TRACK_VICTORY_POINTS } from '#state/botBoards.js'
import type { GameState } from '#state/types.js'

/** Rule: Rootbotics 4.5.3 — the order suit names the building placed. */
export const BUILDING_OF_SUIT: Readonly<Record<Suit, MechanicalMarquiseBuilding>> = {
  fox: 'sawmill',
  rabbit: 'workshop',
  mouse: 'recruiter',
}


export function buildingsOnMap(
  state: GameState,
  seat: Seat,
  building?: MechanicalMarquiseBuilding,
): number {
  return state.clearings
    .flatMap((clearing): Piece[] => clearing.pieces)
    .filter(
      (piece: Piece): boolean =>
        piece.owner === seat &&
        piece.kind === 'building' &&
        (building === undefined || piece.type === building),
    ).length
}

/**
 * Rule: Rootbotics 4.7.3 — the type with the most pieces on the map; a tie
 * with sawmills places a sawmill, a workshop–recruiter tie a recruiter.
 */
export function escalatedBuildingType(
  state: GameState,
  seat: Seat,
): MechanicalMarquiseBuilding {
  const counts = MECHANICAL_MARQUISE_BUILDINGS.map(
    (building: MechanicalMarquiseBuilding): number =>
      buildingsOnMap(state, seat, building),
  )
  const most = Math.max(...counts)
  if (buildingsOnMap(state, seat, 'sawmill') === most) return 'sawmill'
  if (buildingsOnMap(state, seat, 'recruiter') === most) return 'recruiter'
  return 'workshop'
}

/**
 * Rule: Rootbotics 4.5.3 / 4.7.3 — place the building in the clearing it rules
 * with the most Marquise warriors (then highest priority; 2.3: next clearing
 * when it cannot be placed there).
 */
export function placeBotBuilding(
  state: GameState,
  build: { seat: Seat; building: MechanicalMarquiseBuilding },
  ctx: Ctx,
): LogEntry[] {
  const { seat, building } = build
  const track = mechanicalMarquiseBoardOf(state, seat).tracks[building]
  if (track.placed < 1) return []
  const clearings: ClearingId[] = inTargetOrder(ruledClearings(state, seat, ctx), [
    byMost((clearing: ClearingId): number => warriors(state, clearing, seat)),
    byHighestPriority,
  ])
  const clearing = clearings.find(
    (candidate: ClearingId): boolean =>
      openSlots(state, candidate) > 0 && canPlace(state, seat, candidate),
  )
  if (clearing === undefined) return []
  placeUpTo(state, { seat, clearing, spec: { kind: 'building', type: building }, count: 1 })
  track.placed -= 1
  state.turnScratch.botBuiltThisTurn = true
  return [
    { t: 'action', actor: seat, action: { type: 'botBuild', clearing, building } },
    {
      t: 'pieces',
      clearing,
      placed: piecesIn(state, clearing).slice(-1),
    },
  ]
}

/** Rule: Rootbotics 4.6.1 — points on the rightmost empty space of a track. */
export function trackVictoryPoints(
  state: GameState,
  seat: Seat,
  building: MechanicalMarquiseBuilding,
): number {
  const spaces = MECHANICAL_MARQUISE_TRACK_VICTORY_POINTS
  const placed = mechanicalMarquiseBoardOf(state, seat).tracks[building].placed
  const rightmostEmptySpace = spaces.length - 1 - placed
  return spaces[rightmostEmptySpace] ?? 0
}

/** Rule: Rootbotics 4.6.1 — ordered track; a bird scores the best track. */
export function eveningVictoryPoints(
  state: GameState,
  seat: Seat,
  suit: CardSuit,
): number {
  if (suit !== 'bird') return trackVictoryPoints(state, seat, BUILDING_OF_SUIT[suit])
  return Math.max(
    ...MECHANICAL_MARQUISE_BUILDINGS.map(
      (building: MechanicalMarquiseBuilding): number =>
        trackVictoryPoints(state, seat, building),
    ),
  )
}
