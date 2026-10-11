import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
  vagabondPawnTextureKey,
} from '#assets/gameAssets.ts'
import { clearingHasRuin } from '#game/clearingIndicators.ts'
import type { ForestPawnMarker } from '#game/forestLayout.ts'
import type {
  ClearingGround,
  ForestGround,
} from '#game/map3d/groundMarkers.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import type { MapPiece } from '#game/map3d/pieceMeshes.ts'
import { factionColorForSeat, FACTION_COLORS } from '#game/theme.ts'
import {
  pieceViewModelsForClearing,
  textureKeyForStack,
  type BoardClearingPieces,
} from '#react/PieceStack.tsx'
import {
  groupPiecesIntoStacks,
  type PieceStackViewModel,
} from '#ui/PieceView.ts'

export type MapPiecesInput = {
  clearings: readonly BoardClearingPieces[]
  factions: readonly string[]
  clearingGrounds: readonly ClearingGround[]
  forestGrounds: readonly ForestGround[]
  forestPawns: readonly ForestPawnMarker[]
}

/** Stacks stand on a circle this far from the clearing centre. */
const STACK_CIRCLE_RADIUS_RATIO = 0.52
const FULL_TURN_RADIANS = Math.PI * 2
/** First stack at the back of the clearing, the rest follow clockwise. */
const FIRST_STACK_ANGLE_RADIANS = -Math.PI / 2
/** Piece kinds drawn as meeples: they stand in front of the cardboard. */
const MEEPLE_KINDS: ReadonlySet<string> = new Set<string>(['warrior', 'pawn'])

/** Where each of `count` stacks stands: one in the middle, more on a circle. */
function stackGrounds(clearing: ClearingGround, count: number): MapGroundPoint[] {
  if (count === 1) {
    return [clearing.center]
  }
  const circleRadius: number = clearing.radius * STACK_CIRCLE_RADIUS_RATIO
  return Array.from({ length: count }, (_, index: number): MapGroundPoint => {
    const angle: number =
      FIRST_STACK_ANGLE_RADIANS + (index / count) * FULL_TURN_RADIANS
    return {
      x: clearing.center.x + Math.cos(angle) * circleRadius,
      z: clearing.center.z + Math.sin(angle) * circleRadius,
    }
  })
}

function averageGround(points: readonly MapGroundPoint[]): MapGroundPoint {
  const total: MapGroundPoint = points.reduce(
    (sum: MapGroundPoint, point: MapGroundPoint): MapGroundPoint => ({
      x: sum.x + point.x,
      z: sum.z + point.z,
    }),
    { x: 0, z: 0 },
  )
  return { x: total.x / points.length, z: total.z / points.length }
}

function clearingPieces(
  clearingGround: ClearingGround,
  clearing: BoardClearingPieces,
  factions: readonly string[],
): MapPiece[] {
  const clearingId: number = clearingGround.clearingId
  const stacks: PieceStackViewModel[] = groupPiecesIntoStacks(
    pieceViewModelsForClearing(clearing, factions),
  )
  // Buildings and tokens at the back, warriors and pawns in front of them.
  const backStacks: PieceStackViewModel[] = stacks.filter(
    (stack: PieceStackViewModel): boolean => !MEEPLE_KINDS.has(stack.kind),
  )
  const frontStacks: PieceStackViewModel[] = stacks.filter(
    (stack: PieceStackViewModel): boolean => MEEPLE_KINDS.has(stack.kind),
  )
  const pieces: MapPiece[] = [...backStacks, ...frontStacks].map(
    (stack: PieceStackViewModel): MapPiece => {
      const textureKey: string = textureKeyForStack(stack, clearingId)
      return {
        key: `${String(clearingId)}-${stack.kind}-${stack.type ?? ''}-${String(stack.owner)}`,
        textureKey,
        texturePath: imagePathForAssetKey(textureKey),
        color: stack.color,
        count: stack.count,
        ground: clearingGround.center,
      }
    },
  )
  const ruinPieces: MapPiece[] = clearingHasRuin(clearing)
    ? [
        {
          key: `${String(clearingId)}-ruin`,
          textureKey: GAME_ASSET_KEYS.markerRuin,
          texturePath: imagePathForAssetKey(GAME_ASSET_KEYS.markerRuin),
          color: FACTION_COLORS.neutral,
          count: 1,
          ground: clearingGround.center,
        },
      ]
    : []
  const allPieces: MapPiece[] = [...ruinPieces, ...pieces]
  const grounds: MapGroundPoint[] = stackGrounds(
    clearingGround,
    allPieces.length,
  )
  return allPieces.map(
    (piece: MapPiece, index: number): MapPiece => ({
      ...piece,
      ground: grounds[index] ?? clearingGround.center,
    }),
  )
}

/** Every figure to stand on the 3D map for the current board. */
export function mapPiecesForBoard(input: MapPiecesInput): MapPiece[] {
  const pieces: MapPiece[] = input.clearingGrounds.flatMap(
    (clearingGround: ClearingGround): MapPiece[] => {
      const clearing: BoardClearingPieces | undefined =
        input.clearings[clearingGround.clearingId]
      if (clearing === undefined) {
        return []
      }
      return clearingPieces(clearingGround, clearing, input.factions)
    },
  )
  const forestPawnPieces: MapPiece[] = input.forestPawns.flatMap(
    (marker: ForestPawnMarker): MapPiece[] => {
      const forest: ForestGround | undefined = input.forestGrounds.find(
        (entry: ForestGround): boolean =>
          entry.forestIndex === marker.forestIndex,
      )
      if (forest === undefined) {
        return []
      }
      const textureKey: string = vagabondPawnTextureKey(marker.character)
      return [
        {
          key: `forest-pawn-${String(marker.seat)}`,
          textureKey,
          texturePath: imagePathForAssetKey(textureKey),
          color: factionColorForSeat(marker.seat, input.factions),
          count: 1,
          ground: averageGround(forest.corners),
        },
      ]
    },
  )
  return [...pieces, ...forestPawnPieces]
}
